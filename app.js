// Importar las dependencias necesarias
const express = require("express");
const cors = require("cors"); // Importar CORS
const axios = require("axios");

// Inicializar la aplicación de Express
const app = express();
const port = process.env.PORT || 3001; // Render usa un puerto dinámico

// Habilitar CORS para todas las solicitudes
app.use(cors()); // Permitir solicitudes desde cualquier origen

// Middleware para procesar JSON en las peticiones
app.use(express.json());

// Ruta de prueba
app.get("/", (req, res) => {
  res.send("Servidor Express con streaming a OpenAI!");
});

// Ruta para hacer la llamada a la API de OpenAI con streaming
app.post("/openai", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "El campo 'prompt' es necesario" });
  }

  // Configurar los headers para permitir el streaming
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 100,
        stream: true, // Activar streaming
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        responseType: "stream", // Axios manejará la respuesta como un stream
      }
    );

    // Escuchar los datos del stream
    response.data.on("data", (chunk) => {
      const lines = chunk
        .toString("utf8")
        .split("\n")
        .filter((line) => line.trim() !== ""); // Filtrar las líneas no vacías

      for (const line of lines) {
        const message = line.replace(/^data: /, "");

        if (message === "[DONE]") {
          // Cuando OpenAI indica que el stream ha finalizado
          res.end();
          return;
        }

        try {
          const parsed = JSON.parse(message);
          const content = parsed.choices[0].delta?.content;

          if (content) {
            // Enviar el contenido parcial al cliente
            res.write(content);
          }
        } catch (error) {
          console.error("Error al procesar el stream:", error);
        }
      }
    });

    // Manejar errores de streaming
    response.data.on("error", (error) => {
      console.error("Error en el stream de OpenAI:", error);
      res.status(500).json({ error: "Error en el stream de OpenAI" });
    });

  } catch (error) {
    console.error("Error en la solicitud a OpenAI:", error);
    res.status(500).json({ error: "Error al conectar con OpenAI" });
  }
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
