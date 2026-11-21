import re
import unicodedata
from typing import Annotated, Literal
from pydantic import AfterValidator, BaseModel, BeforeValidator, ConfigDict, Field, field_validator, model_validator

Area = Literal["Tecnologia", "Administração", "Economia", "Matemática", "Direito", "Escolar"]
Level = Literal["Básico", "Intermediário", "Avançado"]

def filled(text: str) -> str:
    if not text:
        raise ValueError("Text must not be blank")
    return text

# Texto obrigatório do material. A regra fica num validador, e não em Field(min_length=1), porque o esquema JSON
# enviado ao provedor (StudyOutput.model_json_schema()) foi validado na API real e não pode ganhar palavra-chave nova.
# Desde essa validação ele só mudou pelo campo source de SummaryItem, que rodou na API real em 17/11/2026.
Text = Annotated[str, AfterValidator(filled)]

class Trimmed(BaseModel):
    # Espaços nas pontas não contam como texto: cinco espaços passavam pelo mínimo de caracteres e chegavam à IA,
    # e um material com textos em branco voltava HTTP 200.
    model_config = ConfigDict(str_strip_whitespace=True)

def visible(text):
    # Os caracteres invisíveis de formatação (categoria Unicode Cf) escondiam do aluno uma ordem para a IA (os de tag
    # soletram uma frase que não aparece na tela), e o hífen invisível de texto copiado apagava o "No seu texto".
    return "".join(char for char in text if unicodedata.category(char) != "Cf") if isinstance(text, str) else text

# Texto do aluno que vai ao modelo. A limpeza roda antes do strip e do mínimo de caracteres: só invisíveis vale vazio.
Clean = Annotated[str, BeforeValidator(visible)]

class StudyInput(Trimmed):
    content: Clean = Field(min_length=3, max_length=20000)
    area: Area
    level: Level

# Pergunta que o material já tem. O limite vem antes da limpeza no Annotated: assim ele vale para o texto já limpo e sem
# os espaços das pontas, e o erro é o dos outros textos (string_too_long).
Question = Annotated[str, Field(max_length=500), BeforeValidator(visible)]

class QuizInput(Trimmed):
    # "Questões novas deste material", no fim do quiz: o texto do material (o guardado ou o resumo), a área, o nível e
    # as perguntas que ele já tem (avoid), para não voltarem. Um material guarda até 30 questões.
    content: Clean = Field(min_length=3, max_length=20000)
    area: Area
    level: Level
    avoid: list[Question] = Field(default_factory=list, max_length=30)

class ChatTurn(Trimmed):
    role: Literal["user", "assistant"]
    text: Clean = Field(max_length=4000)

class ChatInput(Trimmed):
    question: Clean = Field(min_length=1, max_length=20000)
    content: Clean = Field(default="", max_length=20000)
    area: Area
    level: Level
    # Últimas mensagens da conversa. Quem manda é o navegador: o servidor não guarda nada.
    history: list[ChatTurn] = Field(default_factory=list, max_length=6)

class ChatOutput(BaseModel):
    answer: str
    suggestions: list[str]

class GradeInput(Trimmed):
    # Revisão de uma questão de resposta curta: enunciado, gabarito e o que o aluno digitou.
    question: Clean = Field(min_length=1, max_length=500)
    expected: Clean = Field(min_length=1, max_length=200)
    answer: Clean = Field(min_length=1, max_length=500)
    area: Area
    level: Level

class GradeOutput(Trimmed):
    verdict: Literal["correta", "parcial", "incorreta"]
    feedback: Text

class ExplainInput(Trimmed):
    # "Explicar com minhas palavras", no Resumo: o título e o texto do tópico e o que o aluno escreveu sem olhar o texto.
    concept: Clean = Field(min_length=1, max_length=300)
    content: Clean = Field(min_length=1, max_length=3000)
    answer: Clean = Field(min_length=1, max_length=1000)
    area: Area
    level: Level

class ExplainOutput(Trimmed):
    # O comentário da IA. missing são trechos copiados do texto do tópico, e o backend descarta o que não está nele
    # (main.explain). default_factory, e não = [] ou = "", para a palavra-chave "default" não entrar no esquema enviado.
    verdict: Literal["completa", "parcial", "incorreta"]
    missing: list[str] = Field(default_factory=list)
    misconception: str = Field(default_factory=str)

class ExampleInput(Trimmed):
    # "Usar um exemplo", na página Estudar: a área e o nível que o aluno escolheu.
    area: Area
    level: Level
    # Tema do exemplo que já está na tela, para o sorteio não repetir. Só o servidor usa: não vai para o modelo.
    avoid: str = Field(default="", max_length=120)

# Markdown que apareceria cru no editor: título (#) ou item de lista (-, *, •, 1.) no começo da linha, e negrito (**).
MARKDOWN = re.compile(r"^\s*(?:#|[-*•]\s|\d+[.)]\s)|\*\*", re.MULTILINE)

class ExampleText(Trimmed):
    # O texto que a IA escreve para o exemplo. O esquema enviado ao provedor sai daqui: as regras do texto ficam no
    # validador, fora do esquema, como nos outros modelos.
    text: Text

    @field_validator("text")
    @classmethod
    def plain_study_text(cls, text):
        # O texto vai para o editor, e dele o aluno gera o material. A instrução pede de 5 a 8 frases: com menos de
        # 150 caracteres não há o que estudar, e com mais de 3.000 o modelo fugiu do pedido.
        if not 150 <= len(text) <= 3000:
            raise ValueError("Example text must have 150 to 3000 characters")
        if MARKDOWN.search(text):
            raise ValueError("Example text must not use markdown")
        return text

class ExampleOutput(BaseModel):
    topic: str
    text: str

class SummaryItem(Trimmed):
    concept: Text
    text: Text
    # Trecho do texto do aluno que sustenta o tópico; "" quando não há (tema sem texto, material antigo).
    # default_factory, e não = "", para a palavra-chave "default" não entrar no esquema enviado ao provedor.
    source: str = Field(default_factory=str)

    @field_validator("source", mode="before")
    @classmethod
    def blank_when_not_text(cls, source):
        # O trecho é um extra: se vier fora do formato (nulo, número), sai só ele, não o tópico.
        return source if isinstance(source, str) else ""

class Card(Trimmed):
    question: Text
    answer: Text

class QuizItem(Trimmed):
    type: Literal["multiple", "boolean", "short"]
    question: Text
    options: list[Text] = Field(default_factory=list)
    answer: int | str
    explanation: Text
    steps: list[str] = Field(default_factory=list)

    @field_validator("steps")
    @classmethod
    def drop_blank_steps(cls, steps):
        # Passo em branco não vale a questão inteira: sai só ele.
        return [step for step in steps if step]

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
            elif kind != "short" and isinstance(answer, str):
                # O esquema enviado aceita texto em answer: além do índice como texto, o modelo pode escrever
                # a própria opção ("Cloroplasto") ou a letra dela ("B").
                text, options = answer.strip().casefold(), data.get("options")
                labels = [str(option).strip().casefold() for option in options] if isinstance(options, list) else []
                if text in labels:
                    # "2" com as opções ["1", "2", "3"] pode ser o índice 2 ou a opção "2". Sem como saber qual,
                    # a questão é recusada: melhor perder uma questão do que ensinar a resposta errada.
                    if text.isdecimal() and int(text) < len(labels) and int(text) != labels.index(text):
                        raise ValueError("Answer can be an option index or another option's text")
                    answer = labels.index(text)
                elif text.isdecimal():
                    answer = int(text)
                elif len(text) == 1 and text in "abcde"[:len(labels)]:
                    answer = "abcde".index(text)
            data = {**data, "answer": answer}
        return data

    @model_validator(mode="after")
    def check_answer(self):
        if self.type == "short":
            if not isinstance(self.answer, str) or not self.answer:
                raise ValueError("Short answer must be a nonempty string")
            # A resposta curta é digitada. O esquema enviado não liga options ao tipo: as opções que vierem junto saem.
            self.options = []
            # A tela compara o que o aluno digita com cada forma separada por "|" e com a resposta inteira.
            forms = [form.strip() for form in self.answer.split("|") if form.strip()]
            if forms:
                # Resposta discursiva não dá para digitar igual: pelo menos uma forma tem de ser curta.
                if not any(len(form) <= 40 and len(form.split()) <= 4 for form in forms):
                    raise ValueError("Short answer is too long to be typed")
                # A resposta fica como o modelo escreveu, porque o aluno também acerta digitando a resposta inteira:
                # reescrita com as formas juntas por "|", "ls | wc -l" virava "ls|wc -l" e "|x|" virava "x".
                # Só saem barras e espaços sobrando no fim ("Selic| "); a que começa com barra fica inteira.
                if not self.answer.startswith("|"):
                    self.answer = self.answer.rstrip("| ")
            # Só barras ("||", o operador OU): não há forma separada, e o aluno acerta digitando a resposta inteira.
            elif len(self.answer) > 40:
                raise ValueError("Short answer is too long to be typed")
        else:
            if type(self.answer) is not int or not 0 <= self.answer < len(self.options):
                raise ValueError("Answer index outside options")
            if self.type == "boolean" and len(self.options) != 2:
                raise ValueError("Boolean requires two options")
            if self.type == "multiple" and len(self.options) < 3:
                raise ValueError("Multiple choice requires at least three options")
            # Com duas opções iguais só uma contava como certa: o aluno errava marcando o mesmo texto.
            if len({option.casefold() for option in self.options}) < len(self.options):
                raise ValueError("Options must be different")
        return self

class QuizOutput(Trimmed):
    # Questões novas de um material. O esquema enviado ao provedor sai daqui, com a lista e a questão do esquema da
    # geração, validado na API real: nenhuma palavra-chave nova.
    quiz: list[QuizItem] = Field(min_length=1, max_length=15)

    @model_validator(mode="after")
    def check_size(self):
        # A instrução pede 6; com menos de 4 o clique não valeu. O mínimo do campo continua 1, como no StudyOutput.
        if len(self.quiz) < 4:
            raise ValueError(f"Quiz needs 4 questions; got {len(self.quiz)}")
        return self

class StudyOutput(Trimmed):
    title: Text
    summary: list[SummaryItem] = Field(min_length=1, max_length=15)
    flashcards: list[Card] = Field(min_length=1, max_length=20)
    quiz: list[QuizItem] = Field(min_length=1, max_length=15)

    @model_validator(mode="after")
    def check_sizes(self):
        # A instrução pede de 6 a 12 tópicos e cartões e 6 questões; abaixo destes mínimos não sobra o que estudar.
        # Os mínimos dos campos acima continuam em 1 para o esquema enviado ao provedor não mudar.
        sizes = len(self.summary), len(self.flashcards), len(self.quiz)
        if sizes[0] < 3 or sizes[1] < 3 or sizes[2] < 4:
            raise ValueError(f"Material needs 3 topics, 3 cards and 4 questions; got {sizes}")
        return self

