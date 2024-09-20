// Importar las dependencias necesarias
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

// Inicializar la aplicación de Express
const app = express();
const port = process.env.PORT || 3001;

// Configurar OpenAI
const configuration = new OpenAI.Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAI.OpenAIApi(configuration);

// Middleware para procesar JSON en las peticiones
app.use(express.json());
app.use(cors());

// Almacenar las conversaciones en memoria (para threading)
const conversations = {};

// Ruta de prueba
app.get("/", (req, res) => {
  res.send("Servidor Express conectado a OpenAI con streaming y threading!");
});

// Ruta para hacer la llamada a la API de OpenAI con streaming y threading
app.post("/openai", async (req, res) => {
  const { prompt, conversationId } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "El campo 'prompt' es necesario" });
  }

  // Configurar los headers para streaming
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Manejo de hilos (threads)
  let messages = [];

  let currentConversationId = conversationId;
  if (currentConversationId && conversations[currentConversationId]) {
    messages = conversations[currentConversationId];
  } else {
    // Generar un nuevo conversationId si no existe
    currentConversationId = Date.now().toString();
    conversations[currentConversationId] = messages;
    res.setHeader('conversation-id', currentConversationId); // Enviar el conversationId al cliente
  }

  // Agregar el mensaje del usuario al historial
  messages.push({ role: "user", content: prompt });

  try {
    // Llamada a la API de OpenAI con streaming
    const completion = await openai.createChatCompletion(
      {
        model: "gpt-3.5-turbo",
        messages: messages,
        stream: true,
      },
      { responseType: "stream" }
    );

    let assistantResponse = "";

    // Escuchar los datos de la respuesta en streaming
    completion.data.on("data", (data) => {
      const lines = data
        .toString()
        .split("\n")
        .filter((line) => line.trim() !== "");

      for (const line of lines) {
        const message = line.replace(/^data: /, "");
        if (message === "[DONE]") {
          // Fin del streaming
          res.end();
          // Guardar el historial de la conversación
          messages.push({ role: "assistant", content: assistantResponse });
          conversations[currentConversationId] = messages;
          break;
        }

        try {
          const parsed = JSON.parse(message);
          const content = parsed.choices[0].delta?.content;
          if (content) {
            // Enviar el contenido al cliente
            res.write(content);
            // Agregar el contenido al mensaje del asistente
            assistantResponse += content;
          }
        } catch (error) {
          console.error("Error al parsear el mensaje:", message, error);
        }
      }
    });

    // Manejar el final del stream
    completion.data.on("end", () => {
      // En caso de que el stream termine sin enviar [DONE]
      res.end();
    });

    // Manejar errores en el stream
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
