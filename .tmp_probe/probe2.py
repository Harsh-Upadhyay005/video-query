import importlib.metadata as m
print("langchain_groq", m.version("langchain-groq"))
print("langchain_core", m.version("langchain-core"))
print("langchain_groq_reqs", m.requires("langchain-groq"))

# Verify ChatGroq accepts the params we will use
from langchain_groq import ChatGroq
import inspect
params = set(inspect.signature(ChatGroq.__init__).parameters) if hasattr(ChatGroq, "__init__") else set()
print("init_params", sorted(params))

# Construct with our intended params (no network call)
c = ChatGroq(model="llama-3.3-70b-versatile", groq_api_key="gsk_test", temperature=0.3, timeout=120, max_retries=0)
print("ChatGroq model_name", c.model_name)
print("DONE")
