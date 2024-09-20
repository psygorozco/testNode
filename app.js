// app.js

require('dotenv').config();
const OpenAI = require("openai");
const express = require("express");
const cors = require("cors");
const { Readable } = require("stream");

const app = express();
const port = process.env.PORT || 3001;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Usar assistantId de las variables de entorno
const assistantId = process.env.ASSISTANT_ID;

app.use(cors());
app.use(express.json());

// Ruta principal para verificar el servidor
app.get("/", (req, res) => {
  res.send("Servidor Express funcionando correctamente!");
});

// Ruta para manejar solicitudes de OpenAI con SSE Simulados
app.post("/openai", async (req, res) => {
  const { prompt, threadId } = req.body;
  if (!prompt) return res.status(400).json({ error: "El campo 'prompt' es necesario" });

  try {
    // Crear o usar un hilo existente
    let thread = threadId || (await openai.beta.threads.create({ messages: [{ role: "user", content: prompt }] })).id;
    if (!threadId) {
      res.setHeader("thread-id", thread);
    }

    // Iniciar el stream desde OpenAI
    const stream = await openai.beta.threads.runs.stream(thread, { assistant_id: assistantId });

    // Configurar encabezados para SSE Simulados
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Función para manejar el streaming de datos
    const handleStream = () => {
      stream.on('textDelta', (delta) => {
        // Formatear los datos en formato SSE
        res.write(`data: ${JSON.stringify({ text: delta.value })}\n\n`);
      }).on('end', () => {
        // Indicar el fin del stream
        res.write(`data: [DONE]\n\n`);
        res.end();
      }).on('error', (err) => {
        console.error("Error en el stream:", err);
        res.write(`data: [ERROR] ${err.message}\n\n`);
        res.end();
      });
    };

    // Iniciar el manejo del stream
    handleStream();

    // Opcional: Manejar la desconexión del cliente
    req.on('close', () => {
      console.log('Cliente desconectado');
      stream.destroy(); // Terminar el stream si el cliente se desconecta
    });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
