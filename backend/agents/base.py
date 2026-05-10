from abc import ABC, abstractmethod
from typing import Any


class BaseAgent(ABC):
    def __init__(self, name: str, llm_client: Any):
        self.name = name
        self.llm = llm_client

    @abstractmethod
    async def execute(self, task: str, context: dict = {}) -> str:
        raise NotImplementedError

    def prompt(self, de: str, en: str, language: str = "de") -> str:
        return de if language == "de" else en

    def __repr__(self):
        return f"<Agent: {self.name}>"
