export type Taxonomy = {
  categories: string[];
  colors: Record<string, string>;
};

const genericTaxonomy: Taxonomy = {
  categories: ["source", "declaration", "config"],
  colors: {
    source: "bg-accent",
    declaration: "bg-emerald-500",
    config: "bg-amber-500",
  },
};

const taxonomies: Record<string, Taxonomy> = {
  next: {
    categories: ["Page routes", "API endpoints", "Server actions"],
    colors: {
      "Page routes": "bg-accent",
      "API endpoints": "bg-emerald-500",
      "Server actions": "bg-amber-500",
    },
  },
  nestjs: {
    categories: ["Controllers", "Services", "Modules", "Entities"],
    colors: {
      Controllers: "bg-accent",
      Services: "bg-emerald-500",
      Modules: "bg-amber-500",
      Entities: "bg-purple-500",
    },
  },
  react: {
    categories: ["Components", "Hooks"],
    colors: {
      Components: "bg-accent",
      Hooks: "bg-emerald-500",
    },
  },
};

export function taxonomyForAdapter(adapter: string): Taxonomy {
  const key = adapter.startsWith("next") ? "next" : adapter;
  return taxonomies[key] ?? genericTaxonomy;
}

export function genericTaxonomyForModuleKind(): Taxonomy {
  return genericTaxonomy;
}
