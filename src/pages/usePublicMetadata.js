import { useEffect } from "react";

export function usePublicMetadata(title, description, path) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;
    const cleanupMeta = [];
    const setMeta = (selector, value) => {
      let element = document.head.querySelector(selector);
      let created = false;
      const previousContent = element?.getAttribute("content");
      if (!element) {
        element = document.createElement("meta");
        const [key, keyValue] = selector.match(/\[(name|property)="([^"]+)"\]/).slice(1);
        element.setAttribute(key, keyValue);
        document.head.appendChild(element);
        created = true;
      }
      element.setAttribute("content", value);
      return () => {
        if (created) element.remove();
        else if (previousContent === null) element.removeAttribute("content");
        else element.setAttribute("content", previousContent);
      };
    };
    cleanupMeta.push(setMeta('meta[name="description"]', description));
    cleanupMeta.push(setMeta('meta[property="og:title"]', title));
    cleanupMeta.push(setMeta('meta[property="og:description"]', description));
    cleanupMeta.push(setMeta('meta[property="og:type"]', "website"));
    const configuredSiteUrl = import.meta.env.VITE_SITE_URL?.replace(/\/$/, "");
    let canonical = document.head.querySelector('link[rel="canonical"]');
    let createdCanonical = false;
    const previousCanonical = canonical?.href;
    if (configuredSiteUrl) {
      const siteOrigin = new URL(configuredSiteUrl).origin;
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.rel = "canonical";
        document.head.appendChild(canonical);
        createdCanonical = true;
      }
      canonical.href = `${siteOrigin}${path}`;
    }
    return () => {
      document.title = previousTitle;
      cleanupMeta.forEach((cleanup) => cleanup());
      if (createdCanonical) canonical.remove();
      else if (canonical && previousCanonical) canonical.href = previousCanonical;
    };
  }, [title, description, path]);
}
