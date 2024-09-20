// Cargar las variables de entorno desde el archivo .env
require("dotenv").config();

// Importar las dependencias necesarias
const express = require("express");
const cors = require("cors");
const { Configuration, OpenAIApi } = require("openai");
const { PassThrough } = require("stream");

// Inicializar la aplicación de Express
const app = express();
const port = process.env.PORT || 3001;

// Middleware para procesar JSON y habilitar CORS
app.use(express.json());
app.use(cors());

// Configurar OpenAI
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Almacenar las conversaciones en memoria
const conversations = {};

// Ruta de prueba
app.get("/", (req, res) => {
  res.send("Servidor Express conectado a OpenAI con streaming!");
});

// Ruta para hacer la llamada a la API de OpenAI con streaming
app.post("/openai", async (req, res) => {
  const { prompt, conversationId } = req.body;

  // Validar que el prompt esté presente
  if (!prompt) {
    return res.status(400).json({ error: "El campo 'prompt' es necesario" });
  }

  // Configurar los headers para permitir el streaming
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Manejo de las conversaciones (threading)
  let messages = [];
  let currentConversationId = conversationId;

  if (currentConversationId && conversations[currentConversationId]) {
    messages = conversations[currentConversationId];
  } else {
    currentConversationId = Date.now().toString();
    conversations[currentConversationId] = messages;
    res.setHeader('conversation-id', currentConversationId); // Enviar el conversationId al cliente
  }

  // Agregar el mensaje del usuario al historial
  messages.push({ role: "user", content: prompt });

  try {
    // Llamada a la API de OpenAI con streaming
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: messages,
      stream: true,
    });

    let assistantResponse = "";
    const stream = new PassThrough(); // Crear un stream para pasar los datos
    stream.pipe(res); // Enviar el stream al cliente

    completion.data.on("data", (data) => {
      const lines = data
        .toString()
        .split("\n")
        .filter((line) => line.trim() !== "");

      for (const line of lines) {
        const message = line.replace(/^data: /, "");
        if (message === "[DONE]") {
          // Fin del streaming
          stream.end();
          messages.push({ role: "assistant", content: assistantResponse });
          conversations[currentConversationId] = messages;
          break;
        }

        try {
          const parsed = JSON.parse(message);
          const content = parsed.choices[0].delta?.content;
          if (content) {
            // Escribir el contenido al stream y agregarlo a la respuesta
            stream.write(content);
            assistantResponse += content;
          }
        } catch (error) {
          console.error("Error al parsear el mensaje:", message, error);
        }
      }
    });

    // Manejar el final del stream
    completion.data.on("end", () => {
      stream.end();
    });

    // Manejar errores del stream
    completion.data.on("error", (error) => {
      console.error("Error en el stream de OpenAI:", error);
      res.status(500).json({ error: "Error en el stream de OpenAI" });
    });
  } catch (error) {
    console.error("Error al conectar con OpenAI:", error);
    res.status(500).json({ error: "Error al conectar con OpenAI" });
  }
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
