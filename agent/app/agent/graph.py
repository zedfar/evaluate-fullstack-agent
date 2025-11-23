from typing import TypedDict, Annotated, Sequence
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolExecutor, ToolInvocation
from langchain.agents import AgentExecutor, create_openai_functions_agent
import operator

from app.config import settings
from app.agent.tools import get_all_tools
from app.services.model_provider import model_provider


class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]
    intermediate_steps: list


def create_agent_graph(provider: str = None):
    """Create a LangGraph agent with tools.

    Args:
        provider: Optional model provider ('local', 'claude', 'openai').
                  Defaults to settings.DEFAULT_MODEL_PROVIDER
    """
    # Initialize LLM using model provider factory
    llm = model_provider.get_chat_model(
        provider=provider,
        temperature=settings.TEMPERATURE,
        streaming=True,
    )

    # Get tools
    tools = get_all_tools()

    # Bind tools to LLM
    llm_with_tools = llm.bind_tools(tools)

    # Create prompt
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a helpful AI assistant with access to various tools.

You can:
- Search the web for current information
- Look up facts on Wikipedia
- Perform calculations

Always think step by step and use tools when necessary to provide accurate information.
Be conversational and helpful."""),
        MessagesPlaceholder(variable_name="messages"),
    ])

    # Tool executor
    tool_executor = ToolExecutor(tools)

    # Define agent function
    def call_model(state: AgentState):
        messages = state["messages"]
        response = llm_with_tools.invoke(messages)
        return {"messages": [response]}

    # Define tool execution function
    def call_tools(state: AgentState):
        messages = state["messages"]
        last_message = messages[-1]

        # Execute tools if there are tool calls
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            tool_results = []
            for tool_call in last_message.tool_calls:
                tool_result = tool_executor.invoke(
                    ToolInvocation(
                        tool=tool_call["name"],
                        tool_input=tool_call["args"],
                    )
                )
                tool_results.append(tool_result)

            return {"messages": tool_results}
        return {"messages": []}

    # Define routing function
    def should_continue(state: AgentState):
        messages = state["messages"]
        last_message = messages[-1]

        # If there are no tool calls, we're done
        if not hasattr(last_message, "tool_calls") or not last_message.tool_calls:
            return "end"
        else:
            return "continue"

    # Build graph
    workflow = StateGraph(AgentState)

    # Add nodes
    workflow.add_node("agent", call_model)
    workflow.add_node("tools", call_tools)

    # Set entry point
    workflow.set_entry_point("agent")

    # Add conditional edges
    workflow.add_conditional_edges(
        "agent",
        should_continue,
        {
            "continue": "tools",
            "end": END,
        },
    )

    # Add edge from tools to agent
    workflow.add_edge("tools", "agent")

    # Compile
    app = workflow.compile()

    return app


# Lazy initialization - will be created on first use
_agent_graph = None


def get_agent_graph(provider: str = None):
    """Get or create the agent graph instance.

    Args:
        provider: Optional model provider. Defaults to settings.DEFAULT_MODEL_PROVIDER

    Returns:
        Compiled LangGraph agent
    """
    global _agent_graph
    if _agent_graph is None:
        _agent_graph = create_agent_graph(provider=provider)
    return _agent_graph
