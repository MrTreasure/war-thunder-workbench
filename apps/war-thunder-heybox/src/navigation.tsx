import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { GameUIIcon } from "./GameUIIcon";

type Entry = { id: string; path: string; title: string; close: () => void };
type Navigation = {
  outlet: HTMLDivElement | null;
  current: string;
  register: (entry: Entry) => () => void;
  back: () => void;
};
const NavigationContext = createContext<Navigation | null>(null);

/** Routes own the detail region; previous screens stay mounted for scroll/draft restoration. */
export function NavigationProvider({
  root,
  suspended = false,
  children,
}: {
  root: string;
  suspended?: boolean;
  children: ReactNode;
}) {
  const [outlet, setOutlet] = useState<HTMLDivElement | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const stack = useRef<Entry[]>([]);
  const rootPath = useRef(root);
  useLayoutEffect(() => {
    rootPath.current = root;
  }, [root]);
  const publish = useCallback((next: Entry[]) => {
    stack.current = next;
    setEntries(next);
  }, []);
  const register = useCallback(
    (entry: Entry) => {
      const next = [...stack.current, entry];
      publish(next);
      history.pushState({ ...history.state, wtDetail: entry.id }, "", entry.path);
      return () => {
        const present = stack.current.some((item) => item.id === entry.id);
        if (!present) return;
        const remaining = stack.current.filter((item) => item.id !== entry.id);
        publish(remaining);
        if (location.hash === entry.path)
          history.replaceState(history.state, "", remaining.at(-1)?.path || rootPath.current);
      };
    },
    [publish],
  );
  const back = useCallback(() => {
    const current = stack.current.at(-1);
    if (!current) return;
    if (location.hash === current.path) history.back();
    else {
      publish(stack.current.slice(0, -1));
      current.close();
    }
  }, [publish]);
  useEffect(() => {
    if (!stack.current.length) history.replaceState(history.state, "", root);
  }, [root]);
  useEffect(() => {
    const pop = () => {
      const last = stack.current.map((item) => item.path).lastIndexOf(location.hash);
      const removed = stack.current.slice(last + 1);
      publish(stack.current.slice(0, last + 1));
      for (const entry of removed.reverse()) entry.close();
      if (last < 0) history.replaceState(history.state, "", rootPath.current);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [publish]);
  const active = entries.at(-1);
  return (
    <NavigationContext value={{ outlet, current: active?.id || "", register, back }}>
      <div className={"hb-screen-stack" + (active ? " has-detail" : "")}>
        <div className="hb-root-screen" hidden={!!active && !suspended}>
          {children}
        </div>
        <section
          className="hb-detail-screen"
          hidden={!active || suspended}
          aria-label={active?.title}
        >
          <header className="hb-detail-header">
            <button type="button" onClick={back} aria-label="返回上一页">
              <GameUIIcon name="back" />
              <span>返回</span>
            </button>
            <h2>{active?.title}</h2>
          </header>
          <div className="hb-detail-outlet" ref={setOutlet} />
        </section>
      </div>
    </NavigationContext>
  );
}

export function DetailPage({
  title,
  path,
  close,
  children,
}: {
  title: string;
  path: string;
  close: () => void;
  children: ReactNode;
}) {
  const navigation = useContext(NavigationContext);
  if (!navigation) throw Error("详情页缺少导航容器");
  const id = useId();
  const closeRef = useRef(close);
  useLayoutEffect(() => {
    closeRef.current = close;
  });
  const register = navigation.register;
  // A stable route stays mounted while its calculation mode/content changes.
  useLayoutEffect(
    () => register({ id, path, title, close: () => closeRef.current() }),
    [id, path, title, register],
  );
  return navigation.outlet
    ? createPortal(
        <section
          className="hb-detail-body hb-scroll"
          hidden={navigation.current !== id}
          aria-label={title}
        >
          {children}
        </section>,
        navigation.outlet,
      )
    : null;
}
