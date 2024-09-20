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
      res.setHeader("x-thread-id", thread);
    }

    // Configurar los headers de la respuesta
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'vary,access-control-allow-origin,x-thread-id,access-control-expose-headers,content-type,transfer-encoding,date,server,connection,x-final-url');
    res.setHeader('Content-Type', 'text/event-stream'); // Mantener text/event-stream para SSE
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Vary', 'Origin');
    res.setHeader('X-Final-URL', `${req.protocol}://${req.get('host')}${req.originalUrl}`);

    // Generar un ID único para esta conversación
    const messageId = uuidv4();

    // Variable para el índice de fragmentos
    let index = 0;

    // Iniciar el stream desde OpenAI
    const stream = await openai.beta.threads.runs.stream(thread, { assistant_id: assistantId });

    // Manejar el streaming de datos
    stream.on('textDelta', (delta) => {
      // Formatear los datos en el formato especificado
      const data = {
        id: `msg_${messageId}`,
        object: "thread.message.delta",
        delta: {
          content: [
            {
              index: index++, // Incrementar el índice en cada fragmento
              type: "text",
              text: {
                value: delta.value,
                annotations: []
              }
            }
          ]
        }
      };
      // Enviar el fragmento al cliente en formato SSE
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }).on('end', () => {
      // Indicar el fin del stream
      res.write(`data: [DONE]\n\n`);
      res.end();
    }).on('error', (err) => {
      console.error("Error en el stream:", err);
      const errorData = {
        id: `msg_${messageId}`,
        object: "thread.message.delta",
        delta: {
          content: [
            {
              index: index,
              type: "error",
              text: {
                value: err.message,
                annotations: []
              }
            }
          ]
        }
      };
      res.write(`data: ${JSON.stringify(errorData)}\n\n`);
      res.end();
    });

    // Manejar la desconexión del cliente
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
