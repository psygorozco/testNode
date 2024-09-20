const OpenAI = require("openai");
const express = require("express");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3001;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Usar assistantId de las variables de entorno
const assistantId = process.env.ASSISTANT_ID;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Servidor Express funcionando correctamente!");
});

app.post("/openai", async (req, res) => {
  const { prompt, threadId } = req.body;
  if (!prompt) return res.status(400).json({ error: "El campo 'prompt' es necesario" });

  try {
    let thread = threadId || (await openai.beta.threads.create({ messages: [{ role: "user", content: prompt }] })).id;
    if (!threadId) {
      res.setHeader("thread-id", thread);
    }

    const stream = await openai.beta.threads.runs.stream(thread, { assistant_id: assistantId });

    stream.on('textDelta', (delta) => {
      res.write(delta.value);
    }).on('end', () => {
      res.end();
    }).on('error', (err) => {
      res.status(500).json({ error: err.message });
    });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
