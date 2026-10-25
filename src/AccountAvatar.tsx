import { useState } from "react";
import "./account-avatar.css";
export type AccountAvatarUser = {
  displayName?: string | null;
  avatarUrl?: string | null;
  avatarFallbackUrl?: string | null;
};
export function AccountAvatar({
  user,
  className = "",
}: {
  user?: AccountAvatarUser | null;
  className?: string;
}) {
  const key = JSON.stringify([user?.avatarUrl, user?.avatarFallbackUrl]);
  const [failure, setFailure] = useState({ key: "", count: 0 });
  const failed = failure.key === key ? failure.count : 0;
  const url = failed === 0 ? user?.avatarUrl : failed === 1 ? user?.avatarFallbackUrl : null;
  return (
    <span className={"wt-account-avatar " + className} aria-hidden="true">
      {url?.startsWith("https://") ? (
        <img
          src={url}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailure({ key, count: failed + 1 })}
        />
      ) : (
        Array.from(user?.displayName || "玩家")[0]
      )}
    </span>
  );
}
