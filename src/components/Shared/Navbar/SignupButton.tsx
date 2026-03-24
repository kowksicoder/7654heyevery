import { Button } from "@/components/Shared/UI";
import useOpenAuth from "@/hooks/useOpenAuth";

interface SignupButtonProps {
  className?: string;
}

const SignupButton = ({ className }: SignupButtonProps) => {
  const openAuth = useOpenAuth();

  return (
    <Button
      className={className}
      onClick={() => void openAuth("open_signup")}
      outline
      size="md"
    >
      Signup
    </Button>
  );
};

export default SignupButton;
