import importlib.metadata as m
import groq

print("groq_version", getattr(groq, "__version__", "no_attr"))
print("groq_reqs", m.requires("groq"))
print("langchain_core", m.version("langchain-core"))
print("langchain_groq_reqs", m.requires("langchain-groq"))
print("DONE")
