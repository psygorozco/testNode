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
    // Hacer la solicitud a la API de OpenAI
    const response = await axios.post(
      "https://api.openai.com/v1/completions",
      {
        model: "text-davinci-003", // Modelo de OpenAI
        prompt: prompt,
        max_tokens: 100,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, // Leer la clave desde las variables de entorno
        },
      }
    );

    // Devolver la respuesta de OpenAI
    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al conectar con OpenAI" });
  }
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
