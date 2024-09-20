// Importar las dependencias necesarias
const express = require("express");
const axios = require("axios");
require("dotenv").config(); // Cargar variables de entorno desde el archivo .env

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
        messages: [{ role: "user", content: prompt }],
        max_tokens: 100,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    // Manejo de errores mejorado (igual que antes)
  }
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
