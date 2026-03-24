import { type MouseEvent, useCallback } from "react";
import evLogo from "@/assets/fonts/evlogo.jpg";
import { Button } from "@/components/Shared/UI";
import useOpenAuth from "@/hooks/useOpenAuth";

interface LoginButtonProps {
  className?: string;
  isBig?: boolean;
  title?: string;
}

const LoginButton = ({
  className = "",
  isBig = false,
  title = "Login"
}: LoginButtonProps) => {
  const openAuth = useOpenAuth();

  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      void openAuth("open_login");
    },
    [openAuth]
  );

  return (
    <Button
      className={className}
      icon={
        <img
          alt="Every1 Logo"
          className="mr-1 size-4 rounded-md object-cover"
          height={16}
          src={evLogo}
          width={16}
        />
      }
      onClick={handleClick}
      size={isBig ? "lg" : "md"}
    >
      {title}
    </Button>
  );
};

export default LoginButton;
