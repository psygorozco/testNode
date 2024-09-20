// Importar las dependencias necesarias
const express = require("express");
const axios = require("axios");

// Inicializar la aplicación de Express
const app = express();
const port = process.env.PORT || 3001;

// Middleware para procesar JSON en las peticiones
app.use(express.json());

// Ruta de prueba
app.get("/", (req, res) => {
  res.send("Servidor Express conectado a OpenAI!");
});

// Ruta para hacer la llamada a la API de OpenAI
app.post("/openai", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt es necesario" });
  }

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: prompt },
        ],
        max_tokens: 100,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Devolver la respuesta de OpenAI
    res.json(response.data);
  } catch (error) {
    // Manejo de errores mejorado
    if (error.response) {
      console.error(
        "Error en la respuesta de OpenAI:",
        error.response.status,
        error.response.data
      );
      res.status(error.response.status).json({
        error:
          error.response.data.error.message ||
          "Error en la respuesta de OpenAI",
      });
    } else if (error.request) {
      console.error("No se recibió respuesta de OpenAI:", error.request);
      res.status(500).json({ error: "No se recibió respuesta de OpenAI" });
    } else {
      console.error(
        "Error al configurar la solicitud a OpenAI:",
        error.message
      );
      res
        .status(500)
        .json({ error: "Error al configurar la solicitud a OpenAI" });
    }
  }
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
