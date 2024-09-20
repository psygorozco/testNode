require('dotenv').config();
const OpenAI = require("openai");
const express = require("express");
const cors = require("cors");
const { v4: uuidv4 } = require('uuid');

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

// Ruta para manejar solicitudes de OpenAI con el formato y headers requeridos
app.post("/openai", async (req, res) => {
  const { prompt, threadId } = req.body;
  if (!prompt) return res.status(400).json({ error: "El campo 'prompt' es necesario" });

  try {
    // Crear o usar un hilo existente
    let thread = threadId || (await openai.beta.threads.create({
      messages: [{ role: "user", content: prompt }]
    })).id;

    // Configurar los headers de la respuesta
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'vary,access-control-allow-origin,x-thread-id,access-control-expose-headers,content-type,transfer-encoding,date,server,connection,x-final-url');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Vary', 'Origin');
    res.setHeader('X-Final-URL', req.protocol + '://' + req.get('host') + req.originalUrl);
    res.setHeader('X-Thread-Id', thread);

    // Generar un ID único para esta conversación
    const messageId = uuidv4();

    // Variable para el índice de fragmentos
    let index = 0;

    // Iniciar el stream desde OpenAI
    const openaiStream = await openai.beta.threads.runs.stream(thread, { assistant_id: assistantId });

    // Manejar el streaming de datos
    openaiStream.on('event', (event) => {
      if (event.event === "thread.message.delta") {
        const deltaContent = event.data.delta.content;
        if (deltaContent) {
          // Formatear y enviar cada fragmento de texto recibido
          deltaContent.forEach((contentItem) => {
            const fragment = {
              id: event.data.id || `msg_${messageId}`,
              object: 'thread.message.delta',
              delta: {
                content: [
                  {
                    index: index++,
                    type: contentItem.type,
                    text: {
                      value: contentItem.text.value,
                      annotations: contentItem.text.annotations || []
                    }
                  }
                ]
              }
            };
            // Enviar el fragmento al cliente en formato SSE
            res.write(`\n${JSON.stringify(fragment)}\n`);
          });
        }
      }
    }).on('end', () => {
      // Indicar el fin del stream
      res.write('\n');
      res.end();
    }).on('error', (err) => {
      console.error("Error en el stream:", err);
      res.status(500).json({ error: err.message });
    });

    // Manejar la desconexión del cliente
    req.on('close', () => {
      console.log('Cliente desconectado');
      openaiStream.destroy(); // Terminar el stream si el cliente se desconecta
    });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
