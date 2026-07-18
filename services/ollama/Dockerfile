# Stage 1: Pull the model into a layer so it is baked into the image.
# Subsequent builds are fast because Docker caches this layer unless the
# MODEL_NAME build arg changes.
FROM ollama/ollama:latest AS model-puller

ARG MODEL_NAME=qwen3:4b-instruct-2507-q4_K_M

# Start the server in the background, wait for it to be ready, pull the model,
# then shut down cleanly so the layer is sealed with the model files in place.
RUN ollama serve & \
    SERVER_PID=$! && \
    until ollama list > /dev/null 2>&1; do sleep 1; done && \
    ollama pull ${MODEL_NAME} && \
    kill $SERVER_PID && \
    wait $SERVER_PID 2>/dev/null || true

# ---

# Stage 2: Minimal runtime image with the pre-pulled model already present.
FROM ollama/ollama:latest

ARG MODEL_NAME=qwen3:4b-instruct-2507-q4_K_M
ENV OLLAMA_MODEL=${MODEL_NAME}

COPY --from=model-puller /root/.ollama /root/.ollama

EXPOSE 11434

ENTRYPOINT ["/bin/ollama"]
CMD ["serve"]
