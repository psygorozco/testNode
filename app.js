import OpenAI from "openai";
import express from "express";
import cors from "cors";

const app = express();
const port = process.env.PORT || 3001;
const openai = new OpenAI();

// Reemplaza este ID con el `assistant_id` del asistente que ya has creado
const ASSISTANT_ID = "tu_assistant_id_aqui";

// Middleware
app.use(cors());
app.use(express.json());

// Ruta para interactuar con el asistente personalizado ya creado
app.post("/openai", async (req, res) => {
  const { prompt, threadId } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "El campo 'prompt' es necesario" });
  }

  try {
    // Crear un nuevo hilo si no existe
    let thread = threadId;
    if (!threadId) {
      thread = await openai.beta.threads.create();
      res.setHeader("thread-id", thread.id); // Devolver el threadId al cliente
    }

    // Agregar el mensaje del usuario al hilo
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: prompt
    });

    // Ejecutar el asistente y hacer streaming de la respuesta
    openai.beta.threads.runs.stream(thread.id, {
      assistant_id: asst_IVAmvHEsePwrzSI4VAeQ8CKz
    })
      .on('textCreated', () => res.write('assistant > '))
      .on('textDelta', (textDelta) => res.write(textDelta.value))
      .on('toolCallCreated', (toolCall) => res.write(`\nHerramienta: ${toolCall.type}\n`))
      .on('toolCallDelta', (toolCallDelta) => {
        if (toolCallDelta.type === 'code_interpreter') {
          if (toolCallDelta.code_interpreter.input) {
            res.write(`Código ejecutado: ${toolCallDelta.code_interpreter.input}`);
          }
          if (toolCallDelta.code_interpreter.outputs) {
            res.write(`\nSalida: ${toolCallDelta.code_interpreter.outputs.map(output => output.logs).join('\n')}\n`);
          }
        }
      })
      .on('end', () => res.end());

  } catch (error) {
    console.error("Error al procesar la solicitud:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
