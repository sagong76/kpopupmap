import type { Lang } from '../config';

type Mod = { frontmatter: { title: string; desc: string; icon: string; order: number }; Content: any };
const mods = import.meta.glob<Mod>('../guides/*/*.md', { eager: true });

export function getGuides(lang: Lang) {
  return Object.entries(mods)
    .map(([path, m]) => {
      const [, l, slug] = path.match(/guides\/(\w+)\/([\w-]+)\.md$/)!;
      return { lang: l, slug, ...m.frontmatter, Content: m.Content };
    })
    .filter((g) => g.lang === lang)
    .sort((a, b) => a.order - b.order);
}
