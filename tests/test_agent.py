"""Agent 配置和基础测试."""

from pydantic import BaseModel

from gk.agent import (
    Agent,
    AgentConfig,
    AgentConnectionError,
    AgentError,
    AgentProcessError,
    AgentRateLimitError,
    AgentValidationError,
    QueryStats,
    output_format_schema,
)

# --- 异常体系 ---


def test_exception_hierarchy():
    assert issubclass(AgentConnectionError, AgentError)
    assert issubclass(AgentProcessError, AgentError)
    assert issubclass(AgentValidationError, AgentError)
    assert issubclass(AgentRateLimitError, AgentError)


def test_agent_process_error():
    e = AgentProcessError("fail", exit_code=1, stderr="oops")
    assert e.exit_code == 1
    assert e.stderr == "oops"


def test_agent_validation_error():
    e = AgentValidationError("bad output", raw_data={"x": 1}, model_class=BaseModel)
    assert e.raw_data == {"x": 1}
    assert e.model_class is BaseModel


def test_agent_rate_limit_error():
    e = AgentRateLimitError("limited", status="rejected", utilization=0.95)
    assert e.status == "rejected"
    assert e.utilization == 0.95


# --- output_format_schema ---


def test_output_format_schema_flat():
    """扁平模型：schema 中不应有 $ref."""
    class FlatModel(BaseModel):
        name: str
        age: int

    fmt = output_format_schema(FlatModel)
    assert fmt["type"] == "json_schema"
    assert fmt["name"] == "FlatModel"
    assert fmt["strict"] is True
    schema = fmt["schema"]
    assert "$defs" not in schema
    assert "properties" in schema
    assert "name" in schema["properties"]


def test_output_format_schema_nested():
    """嵌套模型：$defs 应被内联."""
    class Address(BaseModel):
        city: str

    class Person(BaseModel):
        name: str
        address: Address

    fmt = output_format_schema(Person)
    schema = fmt["schema"]
    assert "$defs" not in schema
    # address 字段应包含内联的 city 属性
    addr_schema = schema["properties"]["address"]
    assert "properties" in addr_schema
    assert "city" in addr_schema["properties"]


def test_output_format_schema_list_nested():
    """列表嵌套模型：list[Item] 的 $defs 也应内联."""
    class Item(BaseModel):
        title: str
        url: str

    class Container(BaseModel):
        items: list[Item]

    fmt = output_format_schema(Container)
    schema = fmt["schema"]
    assert "$defs" not in schema


# --- 配置 ---


def test_agent_config_defaults():
    config = AgentConfig()
    assert config.model is None
    assert config.max_turns == 10
    assert config.cwd is None
    assert config.skills is None
    assert config.permission_mode is None
    assert config.tools is None
    assert config.allowed_tools is None
    assert config.disallowed_tools is None


def test_agent_config_skills():
    config = AgentConfig(skills=["playwright-cli"])
    assert config.skills == ["playwright-cli"]

    config_all = AgentConfig(skills="all")
    assert config_all.skills == "all"


def test_agent_config_permission_mode():
    config = AgentConfig(permission_mode="bypassPermissions")
    assert config.permission_mode == "bypassPermissions"


def test_agent_config_tools():
    config = AgentConfig(
        tools=["Bash", "Read", "Grep"],
        allowed_tools=["Bash", "Read", "Grep"],
    )
    assert config.tools == ["Bash", "Read", "Grep"]
    assert config.allowed_tools == ["Bash", "Read", "Grep"]


# --- QueryStats ---


def test_query_stats_defaults():
    stats = QueryStats()
    assert stats.turns == 0
    assert stats.duration_ms == 0
    assert stats.model == ""
    assert stats.cost_usd is None
    assert stats.input_tokens == 0
    assert stats.output_tokens == 0
    assert stats.tool_calls == 0
    assert stats.tool_calls_detail == {}
    assert stats.structured_output is None
    assert stats.tasks == []


def test_query_stats_with_values():
    stats = QueryStats(
        turns=5, duration_ms=3000, model="claude-sonnet-4-20250514",
        cost_usd=0.0234, input_tokens=1000, output_tokens=500,
        tool_calls=8, stop_reason="end_turn", session_id="abc123",
    )
    assert stats.cost_usd == 0.0234
    assert stats.tool_calls == 8


def test_query_stats_tool_calls_detail():
    stats = QueryStats(tool_calls_detail={"Bash": 3, "Read": 2})
    assert stats.tool_calls_detail["Bash"] == 3
    assert stats.tool_calls_detail["Read"] == 2


# --- Agent 实例 ---


def test_agent_init_with_config():
    config = AgentConfig(model="claude-haiku-4-20250506")
    agent = Agent(config)
    assert agent.config.model == "claude-haiku-4-20250506"


def test_agent_init_default():
    agent = Agent()
    assert agent.config.model is None


def test_agent_last_stats():
    agent = Agent()
    assert agent.last_stats.turns == 0
    assert agent.last_stats.tool_calls == 0


# --- _build_options ---


def test_build_options_output_format():
    """验证 output_format 使用正确的 JSON Schema 格式 + $defs 内联."""
    from gk.models import UniversityInfo

    agent = Agent()
    options = agent._build_options(output_type=UniversityInfo)

    assert options.output_format is not None
    assert options.output_format["type"] == "json_schema"
    assert options.output_format["strict"] is True
    assert options.output_format["name"] == "UniversityInfo"
    schema = options.output_format["schema"]
    assert "properties" in schema
    assert "university" in schema["properties"]
    # $defs 应被内联
    assert "$defs" not in schema


def test_build_options_permission_mode():
    agent = Agent(AgentConfig(permission_mode="bypassPermissions"))
    options = agent._build_options()
    assert options.permission_mode == "bypassPermissions"


def test_build_options_skills():
    agent = Agent(AgentConfig(skills=["playwright-cli"]))
    options = agent._build_options()
    assert options.skills == ["playwright-cli"]


def test_build_options_tools():
    """验证 tools 和 allowed_tools 正确传递."""
    agent = Agent(AgentConfig(
        tools=["Bash", "Read"],
        allowed_tools=["Bash", "Read"],
    ))
    options = agent._build_options()
    assert options.tools == ["Bash", "Read"]
    assert options.allowed_tools == ["Bash", "Read"]


def test_build_options_defaults_none():
    """默认配置下 tools/allowed_tools 应为 None，不限制工具."""
    agent = Agent()
    options = agent._build_options()
    assert options.tools is None
    assert options.allowed_tools is None
