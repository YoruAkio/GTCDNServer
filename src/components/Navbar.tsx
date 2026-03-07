import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { KeyRound, LogOut, Menu, Moon, Sun, UserCircle2, X, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/theme";

interface NavbarProps {
  adminProfile?: {
    name: string;
    email: string;
    onChangePassword: () => void;
    onSignOut: () => void;
  };
}

export default function Navbar({ adminProfile }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!profileRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [profileOpen]);

  return (
    <>
      <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur-md">
        <div className="relative mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          {/* logo — left */}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </Button>

            <Link to="/" className="group flex items-center gap-2.5">
              <div className="bg-primary/15 border-primary/30 text-primary flex size-8 items-center justify-center rounded-lg border transition-colors group-hover:bg-primary/25">
                <Zap className="size-4" strokeWidth={2.5} />
              </div>
              <span className="font-mono text-sm font-semibold tracking-widest uppercase select-none">
                gtcdn
              </span>
            </Link>
          </div>

          {/* nav — absolute center */}
          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
            <Button
              render={<Link to="/" />}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
            >
              Home
            </Button>
          </nav>

          {/* theme toggle — right */}
          <div className="ml-auto flex items-center gap-2">
            {adminProfile && (
              <div className="relative" ref={profileRef}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setProfileOpen((open) => !open)}
                  title="Account"
                >
                  <UserCircle2 className="size-4" />
                </Button>

                {profileOpen && (
                  <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-xl border border-border bg-card p-4 shadow-xl">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">{adminProfile.name}</p>
                      <p className="text-xs text-muted-foreground">{adminProfile.email}</p>
                    </div>

                    <div className="mt-4 space-y-2 border-t border-border pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setProfileOpen(false);
                          adminProfile.onChangePassword();
                        }}
                      >
                        <KeyRound className="size-4" />
                        Change Password
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        onClick={() => {
                          setProfileOpen(false);
                          adminProfile.onSignOut();
                        }}
                      >
                        <LogOut className="size-4" />
                        Log out
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="text-muted-foreground hover:text-foreground size-9"
            >
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* mobile drawer */}
      <aside
        className={`bg-background fixed top-0 left-0 z-50 flex h-full w-72 flex-col border-r shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary/15 border-primary/30 text-primary flex size-7 items-center justify-center rounded-md border">
              <Zap className="size-3.5" strokeWidth={2.5} />
            </div>
            <span className="font-mono text-sm font-semibold tracking-widest uppercase">gtcdn</span>
          </div>
          <Button
            onClick={() => setIsOpen(false)}
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Close menu"
          >
            <X className="size-4" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <Button
            render={<Link to="/" onClick={() => setIsOpen(false)} />}
            variant="ghost"
            className="w-full justify-start text-sm"
          >
            Home
          </Button>
        </nav>

        <div className="border-t p-4 flex items-center justify-between">
          <span className="text-muted-foreground text-xs font-mono">theme</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleTheme}
            className="gap-2 text-xs h-8"
          >
            {theme === "dark" ? (
              <>
                <Sun className="size-3.5" />
                Light
              </>
            ) : (
              <>
                <Moon className="size-3.5" />
                Dark
              </>
            )}
          </Button>
        </div>
      </aside>

      {isOpen ? (
        <button
          type="button"
          className="bg-background/60 fixed inset-0 z-40 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
          aria-label="Close menu overlay"
        />
      ) : null}
    </>
  );
}
