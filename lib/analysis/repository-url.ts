export type RepositoryReference = {
  owner: string;
  name: string;
  url: string;
};

export function parseRepositoryUrl(value: string): RepositoryReference {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("Enter a valid public GitHub repository URL.");
  }

  if (parsed.protocol !== "https:" || parsed.hostname !== "github.com") {
    throw new Error("Only public GitHub repository URLs are supported.");
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length !== 2 || parts.some((part) => !/^[A-Za-z0-9._-]+$/.test(part))) {
    throw new Error("Use a repository URL in the form https://github.com/owner/repository.");
  }

  const owner = parts[0];
  const name = parts[1].replace(/\.git$/, "");
  if (!owner || !name) {
    throw new Error("Use a repository URL in the form https://github.com/owner/repository.");
  }

  return {
    owner,
    name,
    url: `https://github.com/${owner}/${name}`,
  };
}
