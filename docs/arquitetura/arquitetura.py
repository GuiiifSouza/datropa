"""Diagrama de arquitetura GCP do Da Tropa.

Gera arquitetura-da-tropa.png e .svg com:  uv run --with diagrams python arquitetura.py
(precisa do graphviz: brew install graphviz)
"""

from diagrams import Cluster, Diagram, Edge, Node
from diagrams.firebase.develop import Authentication, Hosting
from diagrams.gcp.analytics import BigQuery
from diagrams.gcp.compute import Run
from diagrams.gcp.database import Firestore
from diagrams.gcp.devtools import GCR
from diagrams.gcp.ml import VertexAI
from diagrams.gcp.storage import GCS
from diagrams.generic.storage import Storage
from diagrams.generic.device import Mobile
from diagrams.onprem.ci import GithubActions
from diagrams.onprem.client import User
from diagrams.onprem.vcs import Github

AZUL = "#1a73e8"      # requisição do usuário
ROXO = "#8430ce"      # IA
VERDE = "#188038"     # ingestão de partidas
CINZA = "#5f6368"     # CI/CD

graph_attr = {
    "fontsize": "26",
    "fontname": "Helvetica-Bold",
    "labelloc": "t",
    "pad": "0.6",
    "nodesep": "0.9",
    "ranksep": "1.4",
    "splines": "spline",
    "bgcolor": "white",
}
node_attr = {"fontname": "Helvetica", "fontsize": "13"}
edge_attr = {"fontname": "Helvetica", "fontsize": "12", "penwidth": "1.6"}


def camada(nome, cor):
    return {
        "fontname": "Helvetica-Bold",
        "fontsize": "15",
        "bgcolor": cor,
        "pencolor": "#9aa0a6",
        "style": "rounded",
        "margin": "18",
    }


def nota(texto, cor="#fef7e0", borda="#f9ab00"):
    return Node(
        texto,
        shape="note",
        style="filled",
        fillcolor=cor,
        color=borda,
        fontname="Helvetica",
        fontsize="12",
        fixedsize="false",
        width="0",
        height="0",
        margin="0.25,0.15",
        labeljust="l",
    )


def seta(num, texto, cor, **kw):
    return Edge(label=f" {num}  {texto} ", color=cor, fontcolor=cor, **kw)


with Diagram(
    "Da Tropa · Arquitetura no Google Cloud",
    filename="arquitetura-da-tropa",
    outformat=["png", "svg"],
    direction="LR",
    show=False,
    graph_attr=graph_attr,
    node_attr=node_attr,
    edge_attr=edge_attr,
):
    with Cluster("Usuário", graph_attr=camada("Usuário", "#f1f3f4")):
        usuario = User("Navegador")
        celular = Mobile("Celular")

    riot = Storage("Base do hackathon\nJSONs da organização")

    with Cluster("Projeto GCP · todos os serviços na mesma região",
                 graph_attr=camada("gcp", "#fafbff")):

        with Cluster("Front · Firebase", graph_attr=camada("Front", "#fff8e1")):
            hosting = Hosting("Firebase Hosting\nSPA · devs.datropa.com\nrewrites /api/** · prancheta")
            auth = Authentication("Firebase\nAuthentication")

        with Cluster("Microsserviços · Cloud Run (1 service account cada)",
                     graph_attr=camada("Run", "#e8f0fe")):
            stats = Run("stats\nsa-stats")
            coach = Run("coach · agente\nsa-coach")
            ingest = Run("ingest\nsa-ingest")

        with Cluster("IA", graph_attr=camada("IA", "#f3e8fd")):
            vertex = VertexAI("Vertex AI · Gemini\nagente com tools\nscouting · resumo")

        with Cluster("Dados", graph_attr=camada("Dados", "#e6f4ea")):
            gcs = GCS("Cloud Storage\nraw-matches")
            with Cluster("BigQuery · dataset valorant",
                         graph_attr=camada("BQ", "#ffffff")):
                bronze = BigQuery("bronze\nNDJSON aninhado")
                gold = BigQuery("gold\nrankings · time/mapa · coletiva\neventos_round · mapas")
            firestore = Firestore("Firestore\nusuários · estratégias\nda prancheta · cache")

        seg = nota(
            "Segurança\n"
            "• 1 service account por microsserviço, privilégio mínimo\n"
            "• coach: só leitura no dataset valorant\n"
            "  (tools com SQL parametrizado, limite de bytes)\n"
            "• token do Firebase validado em cada serviço\n"
            "• todos os serviços na mesma região"
        )

    with Cluster("CI/CD", graph_attr=camada("CI", "#f1f3f4")):
        github = Github("GitHub · monorepo\n/front · /services/*")
        actions = GithubActions("GitHub Actions\nWorkload Identity Federation\n(sem chave JSON)")
        registry = GCR("Artifact Registry\nimagens dos containers")

    # Fluxo do usuário
    usuario >> seta(1, "HTTPS devs.datropa.com", AZUL) >> hosting
    celular >> Edge(color=AZUL) >> hosting
    hosting >> seta(2, "login · JWT", AZUL) >> auth
    hosting >> seta(3, "/api/stats/**", AZUL) >> stats
    hosting >> seta(3, "/api/coach/**", AZUL) >> coach

    stats >> seta(4, "leitura", AZUL) >> gold
    stats >> seta(4, "cache", AZUL) >> firestore

    coach >> seta("5a", "agente escolhe tools", ROXO) >> vertex
    coach >> seta("5b", "tools · SQL parametrizado · read-only", ROXO) >> gold

    hosting >> seta(6, "prancheta · estratégias salvas", AZUL) >> firestore

    # Ingestão
    riot >> seta(7, "upload", VERDE, constraint="false") >> gcs
    gcs >> seta(8, "novo arquivo (Eventarc)", VERDE, constraint="false") >> ingest
    ingest >> seta(9, "carrega NDJSON", VERDE) >> bronze
    ingest >> seta(9, "atualiza", VERDE) >> gold

    # CI/CD
    github >> Edge(label=" push / PR ", color=CINZA, fontcolor=CINZA) >> actions
    actions >> Edge(label=" build ", color=CINZA, fontcolor=CINZA) >> registry
    registry >> Edge(label=" deploy só da pasta que mudou ", color=CINZA,
                     fontcolor=CINZA, style="dashed", constraint="false") >> ingest
    actions >> Edge(label=" deploy front + preview por PR ", color=CINZA,
                    fontcolor=CINZA, style="dashed", constraint="false") >> hosting

    # Posiciona a nota de segurança perto dos microsserviços
    coach - Edge(style="invis") - seg
