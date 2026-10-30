export const packageCatalog = [
  {
    id: "git",
    name: "Git",
    description: "Versionsverwaltung für Quellcode und Projekte.",
    category: "Entwicklung",
    platforms: {
      win32: { manager: "winget", packageId: "Git.Git" },
      linux: { manager: "apt", packageId: "git", distributions: ["debian", "ubuntu"] }
    }
  },
  {
    id: "curl",
    name: "cURL",
    description: "Werkzeug für Datenübertragungen und HTTP-Tests.",
    category: "Werkzeuge",
    platforms: {
      win32: { manager: "winget", packageId: "cURL.cURL" },
      linux: { manager: "apt", packageId: "curl", distributions: ["debian", "ubuntu"] }
    }
  },
  {
    id: "vlc",
    name: "VLC media player",
    description: "Medienplayer für viele Audio- und Videoformate.",
    category: "Medien",
    platforms: {
      win32: { manager: "winget", packageId: "VideoLAN.VLC" },
      linux: { manager: "apt", packageId: "vlc", distributions: ["debian", "ubuntu"] }
    }
  },
  {
    id: "7zip",
    name: "7-Zip",
    description: "Archivprogramm für komprimierte Dateien.",
    category: "Werkzeuge",
    platforms: {
      win32: { manager: "winget", packageId: "7zip.7zip" },
      linux: { manager: "apt", packageId: "7zip", distributions: ["debian", "ubuntu"] }
    }
  }
];

export function getCompatiblePackages(platform, distribution) {
  return packageCatalog.map(item => {
    const target = item.platforms[platform];
    if (!target) return null;
    if (target.distributions && !target.distributions.includes(distribution?.id)) return null;
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      manager: target.manager,
      packageId: target.packageId,
      supported: true
    };
  }).filter(Boolean);
}
