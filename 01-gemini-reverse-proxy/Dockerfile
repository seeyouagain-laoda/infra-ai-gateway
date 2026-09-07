FROM python:3.11-slim

WORKDIR /app

# 安装 git 以便拉取上游网页端反代项目
RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

# 上游项目（网页端 → OpenAI 兼容 API，cookie 认证，支持 proxy 字段）
# 如需其他等价项目，替换下方仓库地址即可
RUN git clone --depth=1 https://github.com/cyberanrhy/gemini-claude-web2api.git /app/src

WORKDIR /app/src/gemini

RUN pip install --no-cache-dir -r requirements.txt

# cookie.txt / config.json 通过挂载覆盖，不打包进镜像
CMD ["python", "gemini_web2api.py"]
