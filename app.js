const OpenAI = require("openai");
const express = require("express");
const cors = require("cors");
const { Readable } = require("stream");

const app = express();
const port = process.env.PORT || 3001;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware
app.use(cors());
app.use(express.json());

// Ejecutar una herramienta
const executeToolCall = async (toolCall, execute, logging) => {
  let args;
  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch (err) {
    logging.log(`Error al parsear argumentos: ${toolCall.function.arguments}`);
    throw new Error(`Error al parsear argumentos: ${toolCall.function.arguments}`);
  }

  const output = await execute(toolCall.function.name, args);
  logging.log(`Ejecutada ${toolCall.function.name} con resultado:`, output);

  return {
    tool_call_id: toolCall.id,
    output: output ? JSON.stringify(output) : "",
  };
};

// Manejar el stream de OpenAI (simulación SSE o chunks de texto)
const handleStream = (runStream, stream, streamContentForm, logging, executeToolCall) => {
  const checkForToolCall = async () => {
    const run = runStream.currentRun();
    if (run?.status !== "requires_action") {
      stream.push(null); // Finalizar stream
      return;
    }

    const toolOutputs = await Promise.all(
      run.required_action?.submit_tool_outputs.tool_calls.map(executeToolCall) ?? []
    );

    const newToolStream = openai.beta.threads.runs.submitToolOutputsStream(
      run.thread_id,
      run.id,
      { tool_outputs: toolOutputs }
    );
    logging.log("Nuevo stream iniciado.");
    handleStream(newToolStream, stream, streamContentForm, logging, executeToolCall);
  };

  runStream
    .on("textDelta", (delta) => {
      stream.push(delta.value);
    })
    .on("end", () => {
      logging.log(`${runStream.currentRun()?.id} stream finalizado.`);
      checkForToolCall();
    })
    .on("error", (err) => {
      logging.log(`Error en el stream: ${JSON.stringify(err)}`);
      stream.push(null);
    });
};

// Ruta para interactuar con el asistente
app.post("/openai", async (req, res) => {
  const { prompt, threadId, assistantId } = req.body;
  if (!prompt) return res.status(400).json({ error: "El campo 'prompt' es necesario" });

  try {
    let thread = threadId || await openai.beta.threads.create({ messages: [{ role: "user", content: prompt }] });
    if (!threadId) {
      res.setHeader("thread-id", thread.id); // Enviar threadId al cliente si es nuevo
    } else {
      await openai.beta.threads.messages.create(threadId, { role: "user", content: prompt });
    }

    const assistantStream = openai.beta.threads.runs.stream(threadId, {
      assistant_id: assistantId,
    });

    let stream = new Readable({ read() {} });
    handleStream(assistantStream, stream, "simulated-sse", console, executeToolCall);
    stream.pipe(res);

  } catch (error) {
    console.error("Error al procesar la solicitud:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
