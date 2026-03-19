import {
  ArrowLeftIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  PhotoIcon
} from "@heroicons/react/24/outline";
import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import evLogo from "@/assets/fonts/evlogo.jpg";
import MetaTags from "@/components/Common/MetaTags";
import cn from "@/helpers/cn";

const Create = () => {
  const [searchParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const didApplyPrefill = useRef(false);
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fileName, setFileName] = useState("");
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [showFeeSheet, setShowFeeSheet] = useState(false);
  const [mobileStep, setMobileStep] = useState<"ticker" | "form">("ticker");

  const canSubmit = Boolean(filePreviewUrl && ticker.trim() && name.trim());
  const hasTicker = Boolean(ticker.trim());
  const previewTicker = ticker.trim() || "Creator";
  useEffect(() => {
    return () => {
      if (filePreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  useEffect(() => {
    if (didApplyPrefill.current || description.trim()) {
      return;
    }

    const text = searchParams.get("text");
    const url = searchParams.get("url");
    const via = searchParams.get("via");

    if (!text && !url && !via) {
      return;
    }

    const nextDescription = [text, url, via ? `via @${via}` : null]
      .filter(Boolean)
      .join("\n\n");

    if (!nextDescription) {
      return;
    }

    setDescription(nextDescription);
    didApplyPrefill.current = true;
  }, [description, searchParams]);

  const handleBack = () => {
    window.history.length > 1
      ? window.history.back()
      : (window.location.href = "/");
  };

  const handleTickerChange = (value: string) => {
    setTicker(
      value
        .replace(/[^a-z0-9]/gi, "")
        .slice(0, 8)
        .toLowerCase()
    );
  };

  const handleContinueFromTicker = () => {
    if (!hasTicker) {
      return;
    }

    setMobileStep("form");
  };

  const handleOpenGallery = () => {
    inputRef.current?.click();
  };

  const handleSelectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (filePreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(filePreviewUrl);
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setFileName(file.name);
    setFilePreviewUrl(nextPreviewUrl);
  };

  const renderCreateForm = ({
    desktop = false,
    showIntro = true,
    showTickerField = true,
    submitLabel = "Create coin"
  }: {
    desktop?: boolean;
    showIntro?: boolean;
    showTickerField?: boolean;
    submitLabel?: string;
  }) => (
    <div
      className={cn(
        "border border-gray-200 bg-white shadow-sm dark:border-white/8 dark:bg-[#111214] dark:shadow-none",
        desktop
          ? "h-full max-h-[62vh] min-h-[56vh] overflow-y-auto rounded-[30px] p-5"
          : "rounded-[22px] p-2"
      )}
    >
      {showIntro ? (
        <div className="mb-2 flex flex-col items-center text-center md:mb-3">
          <img
            alt="Every1"
            className={cn(
              "border border-black/5 object-cover dark:border-white/10",
              desktop
                ? "mb-2 h-10 w-10 rounded-2xl"
                : "mb-1.5 h-8 w-8 rounded-xl"
            )}
            src={evLogo}
          />
          <p
            className={cn(
              "text-gray-500 uppercase dark:text-white/45",
              desktop
                ? "text-[11px] tracking-[0.24em]"
                : "text-[10px] tracking-[0.22em]"
            )}
          >
            One-step create
          </p>
          <p
            className={cn(
              "text-balance font-semibold dark:text-white",
              desktop ? "mt-1 text-2xl" : "mt-0.5 text-sm"
            )}
          >
            Upload from gallery and finish everything on one form.
          </p>
        </div>
      ) : null}

      {showTickerField ? (
        <label className="block">
          <span
            className={cn(
              "block text-gray-500 dark:text-white/58",
              desktop ? "mb-1 text-sm" : "mb-0.5 text-[10px]"
            )}
          >
            Ticker
          </span>
          <div
            className={cn(
              "flex items-center bg-gray-100 dark:bg-[#1b1c20]",
              desktop
                ? "rounded-[16px] px-4 py-3.5"
                : "rounded-[14px] px-2.5 py-2"
            )}
          >
            <span
              className={cn(
                "mr-1 font-semibold text-gray-400 dark:text-white/42",
                desktop ? "text-2xl" : "text-sm"
              )}
            >
              ₦
            </span>
            <input
              className={cn(
                "w-full border-none bg-transparent p-0 font-semibold text-gray-950 outline-none placeholder:text-gray-400 focus:ring-0 dark:text-white dark:placeholder:text-white/24",
                desktop ? "text-2xl" : "text-sm"
              )}
              onChange={(event) => handleTickerChange(event.target.value)}
              placeholder="ticker"
              value={ticker}
            />
          </div>
        </label>
      ) : (
        <div className="mb-3 rounded-[16px] bg-gray-100 px-3 py-3 dark:bg-[#1b1c20]">
          <span className="block text-[11px] text-gray-500 dark:text-white/58">
            Ticker
          </span>
          <p className="mt-1 font-semibold text-gray-950 text-lg dark:text-white">
            ₦{previewTicker}
          </p>
        </div>
      )}

      <div
        className={cn(
          showTickerField ? (desktop ? "mt-3" : "mt-2") : "",
          "space-y-2"
        )}
      >
        <label className="block">
          <span
            className={cn(
              "block text-gray-500 dark:text-white/58",
              desktop ? "mb-1 text-sm" : "mb-0.5 text-[10px]"
            )}
          >
            Name
          </span>
          <input
            className={cn(
              "w-full border-none bg-gray-100 font-semibold text-gray-950 outline-none placeholder:text-gray-400 focus:ring-0 dark:bg-[#1b1c20] dark:text-white dark:placeholder:text-white/24",
              desktop
                ? "rounded-[16px] px-4 py-3.5 text-2xl"
                : "rounded-[14px] px-2.5 py-2 text-sm"
            )}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
            value={name}
          />
        </label>

        <label className="block">
          <span
            className={cn(
              "block text-gray-500 dark:text-white/58",
              desktop ? "mb-1 text-sm" : "mb-0.5 text-[10px]"
            )}
          >
            Description
          </span>
          <textarea
            className={cn(
              "w-full resize-none border-none bg-gray-100 text-gray-950 outline-none placeholder:text-gray-400 focus:ring-0 dark:bg-[#1b1c20] dark:text-white dark:placeholder:text-white/24",
              desktop
                ? "min-h-28 rounded-[16px] px-4 py-3.5 text-base"
                : "min-h-16 rounded-[14px] px-2.5 py-2 text-xs"
            )}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Tell people what this post or drop is about"
            value={description}
          />
        </label>
      </div>

      <button
        className={cn(
          "w-full overflow-hidden border border-gray-200 bg-gray-100 transition dark:border-white/10 dark:bg-[#18191d]",
          desktop ? "mt-3 rounded-[18px]" : "mt-2 rounded-[14px]",
          filePreviewUrl ? "p-0" : desktop ? "p-3" : "p-2"
        )}
        onClick={handleOpenGallery}
        type="button"
      >
        {filePreviewUrl ? (
          <div className="relative">
            <img
              alt={fileName || "Selected media"}
              className={cn(
                "w-full object-cover",
                desktop ? "aspect-[4/4.15]" : "aspect-[4/3.1]"
              )}
              src={filePreviewUrl}
            />
            <div
              className={cn(
                "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent",
                desktop ? "px-4 pt-10 pb-4" : "px-2.5 pt-6 pb-2"
              )}
            >
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className={cn(
                      "truncate font-medium text-white/65",
                      desktop ? "text-sm" : "text-[11px]"
                    )}
                  >
                    Selected image
                  </p>
                  <p
                    className={cn(
                      "truncate text-white",
                      desktop ? "text-base" : "text-xs"
                    )}
                  >
                    {fileName}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full bg-white font-medium text-black",
                    desktop ? "px-4 py-2 text-sm" : "px-2 py-1 text-[10px]"
                  )}
                >
                  Change
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "flex items-center justify-center",
              desktop
                ? "gap-3 px-4 py-3 text-left"
                : "gap-2 px-1 py-1 text-left"
            )}
          >
            <div
              className={cn(
                "flex items-center justify-center rounded-full bg-white dark:bg-white/8",
                desktop ? "h-10 w-10" : "h-7 w-7 shrink-0"
              )}
            >
              <PhotoIcon
                className={cn(
                  "text-gray-950 dark:text-white",
                  desktop ? "h-5 w-5" : "h-3.5 w-3.5"
                )}
              />
            </div>
            <div className={cn(desktop ? "min-w-0 flex-1" : "min-w-0 flex-1")}>
              <p
                className={cn(
                  "font-medium text-gray-950 dark:text-white",
                  desktop ? "text-base" : "text-[11px]"
                )}
              >
                Upload from gallery
              </p>
              <p
                className={cn(
                  "mt-0.5 text-gray-500 dark:text-white/55",
                  desktop ? "text-xs" : "text-[9px] leading-4"
                )}
              >
                Add an image for the post.
              </p>
            </div>
          </div>
        )}
      </button>

      <div
        className={cn(
          "bg-gray-100 dark:bg-[#1a1b1f]",
          desktop ? "mt-3 rounded-[18px] p-4" : "mt-2.5 rounded-[16px] p-2.5"
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between",
            desktop ? "py-1 text-base" : "py-0.5 text-xs"
          )}
        >
          <span className="text-gray-600 dark:text-white/72">You receive</span>
          <span className="font-medium text-gray-950 dark:text-white">
            10,000,000
          </span>
        </div>
        <div
          className={cn(
            "flex items-center justify-between",
            desktop ? "py-1 text-base" : "py-0.5 text-xs"
          )}
        >
          <span className="text-gray-600 dark:text-white/72">Post to</span>
          <span className="text-gray-900 dark:text-white/88">Every1 Feed</span>
        </div>
        <button
          className={cn(
            "flex w-full items-center justify-between text-left",
            desktop ? "py-1 text-base" : "py-0.5 text-xs"
          )}
          onClick={() => setShowFeeSheet(true)}
          type="button"
        >
          <span className="inline-flex items-center gap-1 text-gray-600 dark:text-white/72">
            Blockchain fee
            <InformationCircleIcon
              className={desktop ? "h-4 w-4" : "h-3.5 w-3.5"}
            />
          </span>
          <span className="inline-flex items-center gap-1 text-gray-500 dark:text-white/54">
            <CheckCircleIcon className={desktop ? "h-4 w-4" : "h-3.5 w-3.5"} />
            Sponsored by Zora
          </span>
        </button>
      </div>

      <button
        className={cn(
          "w-full rounded-full font-semibold transition",
          desktop ? "mt-3 px-6 py-4 text-2xl" : "mt-2.5 px-4 py-2.5 text-sm",
          canSubmit
            ? "bg-gray-950 text-white dark:bg-white dark:text-black"
            : "bg-gray-200 text-gray-400 dark:bg-white/16 dark:text-white/40"
        )}
        type="button"
      >
        {submitLabel}
      </button>
    </div>
  );

  const renderCreateTabs = ({ desktop = false }: { desktop?: boolean }) => (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-gray-200 bg-white/80 backdrop-blur-sm dark:border-white/8 dark:bg-white/5",
        desktop ? "gap-1.5 p-1.5" : "gap-1 p-1"
      )}
    >
      <span
        className={cn(
          "rounded-full bg-gray-950 font-medium text-white dark:bg-white dark:text-black",
          desktop ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-[11px]"
        )}
      >
        Creator
      </span>
      <span
        className={cn(
          "cursor-not-allowed text-gray-400 dark:text-white/28",
          desktop ? "px-2.5 text-sm" : "px-2 text-[11px]"
        )}
      >
        Collaboration
      </span>
      <span
        className={cn(
          "cursor-not-allowed text-gray-400 dark:text-white/28",
          desktop ? "px-2.5 text-sm" : "px-2 text-[11px]"
        )}
      >
        Community
      </span>
    </div>
  );

  return (
    <>
      <MetaTags description="Create on Every1." title="Create" />
      <input
        accept="image/*"
        className="hidden"
        onChange={handleSelectFile}
        ref={inputRef}
        type="file"
      />

      <div
        className="min-h-screen bg-gray-50 text-gray-950 dark:bg-[#08090b] dark:text-white"
        style={{
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          paddingTop: "max(8px, env(safe-area-inset-top))"
        }}
      >
        <div className="md:hidden">
          {mobileStep === "ticker" ? (
            <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col px-4">
              <div className="flex items-center justify-between py-1">
                <button
                  aria-label="Back"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-gray-950 dark:text-white"
                  onClick={handleBack}
                  type="button"
                >
                  <ArrowLeftIcon className="h-7 w-7" />
                </button>
                {renderCreateTabs({ desktop: false })}
                <div className="h-10 w-10" />
              </div>

              <div className="flex flex-1 flex-col justify-center pb-14">
                <div className="text-center">
                  <p className="inline-flex items-center gap-1.5 text-gray-500 text-sm dark:text-white/45">
                    Launch a creator coin
                    <InformationCircleIcon className="h-4 w-4" />
                  </p>
                  <p
                    className={cn(
                      "mt-6 font-semibold text-6xl tracking-tight",
                      hasTicker
                        ? "text-gray-950 dark:text-white"
                        : "text-gray-300 dark:text-white/22"
                    )}
                  >
                    ₦{previewTicker}
                  </p>
                  {hasTicker ? (
                    <p className="mt-4 inline-flex items-center gap-1.5 text-green-500 text-lg">
                      <CheckCircleIcon className="h-5 w-5" />
                      Available
                    </p>
                  ) : null}
                </div>

                <div className="mt-12">
                  <div className="rounded-[22px] bg-gray-200/90 px-5 py-4 dark:bg-white/10">
                    <input
                      className="w-full border-none bg-transparent p-0 text-center font-medium text-gray-950 text-lg outline-none placeholder:text-gray-400 focus:ring-0 dark:text-white dark:placeholder:text-white/24"
                      onChange={(event) =>
                        handleTickerChange(event.target.value)
                      }
                      placeholder="Enter a ticker"
                      value={ticker}
                    />
                  </div>

                  <button
                    className={cn(
                      "mt-5 w-full rounded-[22px] px-5 py-4 font-semibold text-lg transition",
                      hasTicker
                        ? "bg-gray-950 text-white dark:bg-white dark:text-black"
                        : "bg-gray-200 text-gray-400 dark:bg-white/12 dark:text-white/30"
                    )}
                    onClick={handleContinueFromTicker}
                    type="button"
                  >
                    {hasTicker ? `Launch ₦${ticker.trim()}` : "Proceed"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col px-4">
              <div className="flex items-center justify-between py-1">
                <button
                  aria-label="Back to ticker"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-gray-950 dark:text-white"
                  onClick={() => setMobileStep("ticker")}
                  type="button"
                >
                  <ArrowLeftIcon className="h-6 w-6" />
                </button>
                {renderCreateTabs({ desktop: false })}
                <div className="h-10 w-10" />
              </div>

              <div className="flex-1 py-4">
                <div className="pb-6 text-center">
                  <p className="inline-flex items-center gap-1.5 text-gray-500 text-sm dark:text-white/45">
                    Launch a creator coin
                    <InformationCircleIcon className="h-4 w-4" />
                  </p>
                  <p className="mt-5 font-semibold text-5xl text-gray-950 tracking-tight dark:text-white">
                    ₦{previewTicker}
                  </p>
                  <p className="mt-3 inline-flex items-center gap-1.5 text-green-500">
                    <CheckCircleIcon className="h-5 w-5" />
                    Available
                  </p>
                </div>

                {renderCreateForm({
                  showIntro: false,
                  showTickerField: false,
                  submitLabel: "Create coin"
                })}
              </div>
            </div>
          )}
        </div>

        <div className="mx-auto hidden min-h-screen w-full max-w-6xl flex-col px-6 md:flex">
          <div className="flex items-center justify-between py-1">
            <button
              aria-label="Back"
              className="flex h-10 w-10 items-center justify-center rounded-full text-gray-950 dark:text-white"
              onClick={handleBack}
              type="button"
            >
              <ArrowLeftIcon className="h-6 w-6" />
            </button>
            <p className="font-medium text-2xl">Create</p>
            <div className="h-10 w-10" />
          </div>

          <div className="mt-2 flex justify-center">
            {renderCreateTabs({ desktop: true })}
          </div>

          <div className="grid h-[60vh] max-h-[620px] min-h-[520px] flex-1 grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] gap-5 py-6">
            <div className="h-full">
              {renderCreateForm({ desktop: true, submitLabel: "Create coin" })}
            </div>

            <aside className="relative h-full overflow-hidden rounded-[32px] border border-gray-200 bg-[#dfe5ef] dark:border-white/8 dark:bg-[#0f1115]">
              {filePreviewUrl ? (
                <img
                  alt={fileName || "Banner preview"}
                  className="absolute inset-0 h-full w-full object-cover"
                  src={filePreviewUrl}
                />
              ) : (
                <>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.95),transparent_38%),linear-gradient(145deg,#edf2f7_0%,#d8e1eb_34%,#b7c3d6_100%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_34%),linear-gradient(145deg,#161920_0%,#101219_45%,#090b10_100%)]" />
                  <div className="absolute top-[-48px] right-[-24px] h-52 w-52 rounded-full bg-fuchsia-300/30 blur-3xl dark:bg-fuchsia-500/18" />
                  <div className="absolute bottom-[-60px] left-[-36px] h-56 w-56 rounded-full bg-sky-300/30 blur-3xl dark:bg-sky-500/18" />
                  <img
                    alt="Every1 banner"
                    className="absolute top-1/2 left-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-[2rem] opacity-80 shadow-2xl"
                    src={evLogo}
                  />
                </>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/18 to-transparent" />
              <div className="relative flex h-full flex-col justify-between p-6">
                <div className="inline-flex w-fit items-center gap-2 rounded-full bg-black/30 px-3 py-2 text-white backdrop-blur-md">
                  <img
                    alt="Every1"
                    className="h-7 w-7 rounded-full object-cover ring-1 ring-white/25"
                    src={evLogo}
                  />
                  <span className="font-medium text-sm">Every1 Create</span>
                </div>

                <div>
                  <div className="mb-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white/16 px-3 py-1.5 text-white text-xs backdrop-blur-md">
                      ₦{previewTicker}
                    </span>
                    <span className="rounded-full bg-white/16 px-3 py-1.5 text-white text-xs backdrop-blur-md">
                      {filePreviewUrl ? "Cover ready" : "Add cover image"}
                    </span>
                  </div>
                  <p className="max-w-sm font-semibold text-4xl text-white leading-tight">
                    Shape the story before it hits the feed.
                  </p>
                  <p className="mt-3 max-w-sm text-sm text-white/78 leading-6">
                    A tighter desktop canvas for ticker, cover, caption, and
                    launch.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>

        {showFeeSheet ? (
          <div className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm dark:bg-black/70">
            <button
              aria-label="Close fee information"
              className="absolute inset-0"
              onClick={() => setShowFeeSheet(false)}
              type="button"
            />
            <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-xl rounded-t-[28px] bg-white px-5 pt-4 pb-6 md:px-6 md:pb-8 dark:bg-[#1b1b1b]">
              <div className="mx-auto mb-5 h-1.5 w-14 rounded-full bg-gray-300 dark:bg-white/14" />
              <p className="font-semibold text-2xl text-gray-950 md:text-[2rem] dark:text-white">
                Understanding blockchain fees
              </p>
              <p className="mt-3 text-gray-600 text-sm leading-6 md:mt-4 md:text-lg md:leading-8 dark:text-white/64">
                This is the fee paid to the Base network to process your
                transaction. It varies with network demand and is not controlled
                by Zora.
              </p>
              <button
                className="mt-6 w-full rounded-full bg-gray-950 px-5 py-3.5 font-semibold text-lg text-white md:mt-8 md:px-6 md:py-4 md:text-2xl dark:bg-white dark:text-black"
                onClick={() => setShowFeeSheet(false)}
                type="button"
              >
                Got it
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
};

export default Create;
