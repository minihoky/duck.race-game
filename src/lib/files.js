export function readPngFile(file, t = (text) => text) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error(t("Choose a PNG image.")));
      return;
    }
    const lower = (file.name || "").toLowerCase();
    if (file.type && file.type !== "image/png" && !lower.endsWith(".png")) {
      reject(new Error(t("Sponsor images must be PNG files.")));
      return;
    }
    if (file.size > 1_500_000) {
      reject(new Error(t("Use a PNG smaller than 1.5 MB.")));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const name = (file.name || "Sponsor").replace(/\.png$/i, "").slice(0, 40) || "Sponsor";
      resolve({ name, png: String(reader.result || "") });
    };
    reader.onerror = () => reject(new Error(t("That image could not be read.")));
    reader.readAsDataURL(file);
  });
}
