import { useEffect } from "react";
import { siteName } from "../content/site";

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${siteName}` : siteName;
  }, [title]);
}
