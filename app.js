require('dotenv').config();
const OpenAI = require("openai");
const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require('uuid'); // Importar uuid

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

    // Generar un ID único para esta conversación
    const messageId = uuidv4();

    // Función para manejar el streaming de datos
    const handleStream = () => {
      stream.on('textDelta', (delta) => {
        // Formatear los datos en el formato especificado
        const data = {
          id: `msg_${messageId}`,
          object: "thread.message.delta",
          delta: {
            content: [
              {
                index: 0, // Puedes ajustar el índice si es necesario
                type: "text",
                text: {
                  value: delta.value
                }
              }
            ]
          }
        };
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }).on('end', () => {
        // Indicar el fin del stream
        const doneData = {
          id: `msg_${messageId}`,
          object: "thread.message.delta",
          delta: {
            content: [
              {
                index: 0,
                type: "text",
                text: {
                  value: "[DONE]"
                }
              }
            ]
          }
        };
        res.write(`data: ${JSON.stringify(doneData)}\n\n`);
        res.end();
      }).on('error', (err) => {
        console.error("Error en el stream:", err);
        const errorData = {
          id: `msg_${messageId}`,
          object: "thread.message.delta",
          delta: {
            content: [
              {
                index: 0,
                type: "error",
                text: {
                  value: err.message
                }
              }
            ]
          }
        };
        res.write(`data: ${JSON.stringify(errorData)}\n\n`);
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
