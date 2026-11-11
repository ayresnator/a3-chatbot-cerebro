from typing import Literal
from pydantic import BaseModel, Field, model_validator

Area = Literal["Tecnologia", "Administração", "Economia", "Matemática", "Direito", "Escolar"]
Level = Literal["Básico", "Intermediário", "Avançado"]

class StudyInput(BaseModel):
    content: str = Field(min_length=3, max_length=20000)
    area: Area
    level: Level

class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    text: str = Field(max_length=4000)

class ChatInput(BaseModel):
    question: str = Field(min_length=1, max_length=20000)
    content: str = Field(default="", max_length=20000)
    area: Area
    level: Level
    # Últimas mensagens da conversa. Quem manda é o navegador: o servidor não guarda nada.
    history: list[ChatTurn] = Field(default_factory=list, max_length=6)

class SummaryItem(BaseModel):
    concept: str
    text: str

class Card(BaseModel):
    question: str
    answer: str

class QuizItem(BaseModel):
    type: Literal["multiple", "boolean", "short"]
    question: str
    options: list[str] = Field(default_factory=list)
    answer: int | str
    explanation: str
    steps: list[str] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def normalize_answer(cls, data):
        # O modelo às vezes troca o tipo de answer. Índice como texto ("1") derrubava o material
        # inteiro; true/false era convertido em 1/0 pelo Pydantic e invertia a resposta certa.
        if isinstance(data, dict) and "answer" in data:
            answer, kind = data["answer"], data.get("type")
            if isinstance(answer, bool):
                # true/false só tem leitura segura quando as opções são exatamente as do prompt.
                if kind != "boolean" or data.get("options") != ["Verdadeiro", "Falso"]:
                    raise ValueError("Answer must be an option index, not true/false")
                answer = 0 if answer else 1
            elif kind == "short" and isinstance(answer, (int, float)):
                answer = str(answer).removesuffix(".0")
            elif kind != "short" and isinstance(answer, str) and answer.strip().isdecimal():
                answer = int(answer)
            data = {**data, "answer": answer}
        return data

    @model_validator(mode="after")
    def check_answer(self):
        if self.type == "short":
            if not isinstance(self.answer, str) or not self.answer.strip():
                raise ValueError("Short answer must be a nonempty string")
        else:
            if type(self.answer) is not int or not 0 <= self.answer < len(self.options):
                raise ValueError("Answer index outside options")
            if self.type == "boolean" and len(self.options) != 2:
                raise ValueError("Boolean requires two options")
            if self.type == "multiple" and len(self.options) < 3:
                raise ValueError("Multiple choice requires at least three options")
        return self

class StudyOutput(BaseModel):
    title: str
    summary: list[SummaryItem] = Field(min_length=1, max_length=15)
    flashcards: list[Card] = Field(min_length=1, max_length=20)
    quiz: list[QuizItem] = Field(min_length=1, max_length=15)

