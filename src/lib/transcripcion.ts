// Descarga un mensaje de voz de Telegram (file_id) y lo manda a transcribir
// al mismo servicio Python que ya expone el scraper de HYM (server.py,
// endpoint /transcribir, Whisper local corriendo en la PC de Daniel).
export async function transcribirVozTelegram(fileId: string): Promise<string | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const scraperUrl = process.env.HYM_SCRAPER_URL;
  const scraperSecret = process.env.HYM_SCRAPER_SECRET;
  if (!botToken || !scraperUrl || !scraperSecret) {
    console.error("transcripcion: faltan variables de entorno (TELEGRAM_BOT_TOKEN, HYM_SCRAPER_URL, HYM_SCRAPER_SECRET)");
    return null;
  }

  try {
    const resFile = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`);
    const dataFile = await resFile.json();
    const filePath = dataFile?.result?.file_path;
    if (!filePath) {
      console.error("transcripcion: getFile no devolvió file_path", dataFile);
      return null;
    }

    const resAudio = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
    const audioBuffer = Buffer.from(await resAudio.arrayBuffer());

    const resTranscribir = await fetch(`${scraperUrl}/transcribir`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "X-Api-Key": scraperSecret },
      body: audioBuffer,
      signal: AbortSignal.timeout(60000),
    });

    if (!resTranscribir.ok) {
      console.error(`transcripcion: servicio respondió ${resTranscribir.status}: ${await resTranscribir.text()}`);
      return null;
    }

    const data = await resTranscribir.json();
    return typeof data.texto === "string" ? data.texto.trim() : null;
  } catch (error) {
    console.error("transcripcion: excepción transcribiendo", error);
    return null;
  }
}
