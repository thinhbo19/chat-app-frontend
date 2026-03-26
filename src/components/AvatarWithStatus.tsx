import { Avatar } from "antd";
import type { AvatarProps } from "antd";

type AvatarWithStatusProps = {
  children: React.ReactNode;
  online: boolean;
} & Omit<AvatarProps, "children">;

export function AvatarWithStatus({ children, online, className, ...avatarProps }: AvatarWithStatusProps) {
  return (
    <span className={`avatar-status-wrap${className ? ` ${className}` : ""}`}>
      <Avatar {...avatarProps}>{children}</Avatar>
      <span className={`avatar-status-dot ${online ? "online" : "offline"}`} aria-hidden />
    </span>
  );
}
