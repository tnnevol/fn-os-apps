window.__ModuleLoader__.load({
	id: "@tnnevol/dsh-codex-auth",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/CodexCapabilities.tsx
		/** Live optional-capability settings for the Codex Auth plugin. */
		const sectionStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 12,
			borderTop: "1px solid var(--dsw-alias-border-l2)",
			paddingTop: 14
		};
		const headingStyle = {
			margin: 0,
			fontSize: 14,
			lineHeight: "20px",
			fontWeight: 600,
			color: "var(--dsw-alias-label-primary)"
		};
		const bodyStyle$1 = {
			margin: 0,
			fontSize: 12,
			lineHeight: "18px",
			color: "var(--dsw-alias-label-secondary)"
		};
		const fieldsetStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 12,
			margin: 0,
			padding: 0,
			border: 0
		};
		const rowStyle$1 = {
			display: "flex",
			alignItems: "flex-start",
			gap: 9,
			cursor: "pointer"
		};
		const disabledRowStyle = {
			...rowStyle$1,
			cursor: "not-allowed",
			opacity: .62
		};
		const copyStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 2
		};
		const labelStyle = {
			fontSize: 13,
			lineHeight: "18px",
			fontWeight: 500,
			color: "var(--dsw-alias-label-primary)"
		};
		const actionsStyle = {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 10,
			flexWrap: "wrap"
		};
		const buttonsStyle = {
			display: "flex",
			gap: 8
		};
		const buttonStyle$1 = {
			boxSizing: "border-box",
			minHeight: 30,
			padding: "4px 12px",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 16,
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			fontSize: 12,
			cursor: "pointer"
		};
		const primaryButtonStyle$1 = {
			...buttonStyle$1,
			border: 0,
			background: "var(--dsw-alias-button-primary-fill)",
			color: "var(--dsw-alias-label-primary-foreground)"
		};
		const errorStyle$1 = {
			...bodyStyle$1,
			color: "var(--dsw-alias-state-error-primary, #d92d20)"
		};
		const successStyle = {
			...bodyStyle$1,
			color: "var(--dsw-alias-state-success-primary, #16825d)"
		};
		const UNAVAILABLE_SNAPSHOT = {
			status: "unavailable",
			value: void 0,
			base: void 0,
			user: void 0,
			revision: void 0,
			writable: false,
			mode: "memory"
		};
		/** Render the capability controls with the same Save/Discard contract as DSH settings. */
		function CodexCapabilities({ scope, t }) {
			const subscribe = (0, react.useCallback)((listener) => scope?.subscribe(listener) ?? (() => void 0), [scope]);
			const getSnapshot = (0, react.useCallback)(() => scope?.getSnapshot() ?? UNAVAILABLE_SNAPSHOT, [scope]);
			const snapshot = (0, react.useSyncExternalStore)(subscribe, getSnapshot, getSnapshot);
			const [draft, setDraft] = (0, react.useState)(snapshot.value);
			const [dirty, setDirty] = (0, react.useState)(false);
			const [busy, setBusy] = (0, react.useState)(false);
			const [feedback, setFeedback] = (0, react.useState)("idle");
			(0, react.useEffect)(() => {
				if (!dirty && !busy) setDraft(snapshot.value);
			}, [
				busy,
				dirty,
				snapshot.revision,
				snapshot.value
			]);
			const updateImageTool = (enabled) => {
				setDraft((current) => current === void 0 ? current : {
					...current,
					enableImageTool: enabled
				});
				setDirty(true);
				setFeedback("idle");
			};
			const updateImageUpload = (enabled) => {
				setDraft((current) => current === void 0 ? current : {
					...current,
					enableImageUpload: enabled
				});
				setDirty(true);
				setFeedback("idle");
			};
			const discard = () => {
				setDraft(scope?.getSnapshot().value);
				setDirty(false);
				setFeedback("idle");
			};
			const save = async () => {
				if (scope === void 0 || draft === void 0 || !snapshot.writable || busy) return;
				setBusy(true);
				setFeedback("idle");
				try {
					await scope.set("enableImageTool", draft.enableImageTool);
					await scope.set("enableImageUpload", draft.enableImageUpload);
					const accepted = scope.getSnapshot().value;
					if (accepted?.enableImageTool !== draft.enableImageTool || accepted?.enableImageUpload !== draft.enableImageUpload) throw new Error("Host returned a different image setting");
					setDraft(accepted);
					setDirty(false);
					setFeedback("saved");
				} catch {
					setDraft(scope.getSnapshot().value);
					setDirty(false);
					setFeedback("error");
				} finally {
					setBusy(false);
				}
			};
			const loading = snapshot.status === "loading";
			const editable = snapshot.status === "ready" && snapshot.writable && !busy;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				style: sectionStyle,
				"aria-labelledby": "dsh-codex-capabilities-title",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						id: "dsh-codex-capabilities-title",
						style: headingStyle,
						children: t("capabilitiesTitle")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: {
							...bodyStyle$1,
							marginTop: 3
						},
						children: t("capabilitiesIntro")
					})] }),
					loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: bodyStyle$1,
						role: "status",
						children: t("settingsLoading")
					}) : null,
					snapshot.status === "unavailable" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: errorStyle$1,
						role: "alert",
						children: t("settingsUnavailable")
					}) : null,
					snapshot.status === "ready" && !snapshot.writable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: errorStyle$1,
						role: "alert",
						children: t("settingsReadOnly")
					}) : null,
					draft === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
						style: fieldsetStyle,
						disabled: !editable,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								style: rowStyle$1,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: draft.enableImageTool,
									onChange: (event) => {
										updateImageTool(event.currentTarget.checked);
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: copyStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: labelStyle,
										children: t("enableImageRecognition")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: bodyStyle$1,
										children: t("enableImageRecognitionHelp")
									})]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								style: rowStyle$1,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: draft.enableImageUpload,
									onChange: (event) => {
										updateImageUpload(event.currentTarget.checked);
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: copyStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: labelStyle,
										children: t("enableImageUpload")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: bodyStyle$1,
										children: t("enableImageUploadHelp")
									})]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								style: disabledRowStyle,
								title: t("imageGenerationUnavailableHelp"),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: false,
									disabled: true,
									"aria-label": t("enableImageGeneration"),
									readOnly: true
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									style: copyStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: labelStyle,
										children: t("enableImageGeneration")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: bodyStyle$1,
										children: t("imageGenerationUnavailableHelp")
									})]
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: actionsStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							"aria-live": "polite",
							children: [feedback === "saved" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: successStyle,
								children: t("settingsSaved")
							}) : null, feedback === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: errorStyle$1,
								children: t("settingsSaveFailed")
							}) : null]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							style: buttonsStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: buttonStyle$1,
								disabled: !dirty || busy,
								onClick: discard,
								children: t("discard")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: primaryButtonStyle$1,
								disabled: !dirty || !snapshot.writable || busy,
								onClick: () => {
									save();
								},
								children: busy ? t("saving") : t("save")
							})]
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/auth-paths.ts
		/** Browser-facing paths owned by the standalone Codex authentication plugin. */
		/** Host settings namespace used to dispatch the browser settings card. */
		const CODEX_AUTH_SETTINGS_NAMESPACE = "dsh-codex-auth";
		const CODEX_AUTH_STATUS_PATH = "/plugins/dsh-codex-auth-plugin/auth/status";
		const CODEX_AUTH_LOGIN_PATH = "/plugins/dsh-codex-auth-plugin/auth/login";
		const CODEX_AUTH_LOGOUT_PATH = "/plugins/dsh-codex-auth-plugin/auth/logout";
		const CODEX_USAGE_PATH = "/plugins/dsh-codex-auth-plugin/auth/usage";
		/** Same-origin settings endpoint used when DSH marks a NAS browser as remote. */
		const CODEX_AUTH_SETTINGS_PATH = "/plugins/dsh-codex-auth-plugin/auth/settings";
		//#endregion
		//#region src/client/CodexAuthCard.tsx
		/** Expandable account card for the DSH Plugins settings section. */
		const cardStyle = {
			overflow: "hidden",
			listStyle: "none",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 12,
			background: "var(--dsw-alias-bg-layer-3)",
			transition: "border-color 160ms ease, background 160ms ease"
		};
		const cardOpenStyle = {
			background: "var(--dsw-alias-bg-layer-2)",
			borderColor: "var(--dsw-alias-label-dimmed)"
		};
		const headerStyle = {
			boxSizing: "border-box",
			width: "100%",
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 12,
			border: 0,
			padding: "14px 16px",
			borderRadius: 12,
			background: "none",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			textAlign: "left",
			cursor: "pointer"
		};
		const headTextStyle = {
			display: "flex",
			minWidth: 0,
			flexDirection: "column",
			gap: 4
		};
		const nameStyle = {
			fontSize: 15,
			lineHeight: "1.4",
			fontWeight: 600
		};
		const descriptionStyle = {
			fontSize: 13,
			lineHeight: "1.5",
			color: "var(--dsw-alias-label-tertiary)"
		};
		const bodyStyle = {
			margin: 0,
			fontSize: 13,
			lineHeight: "20px",
			color: "var(--dsw-alias-label-secondary)"
		};
		const errorStyle = {
			...bodyStyle,
			color: "var(--dsw-alias-state-error-primary, #d92d20)"
		};
		const cardBodyStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 14,
			borderTop: "1px solid var(--dsw-alias-border-l2)",
			margin: "0 16px",
			padding: "12px 0 8px"
		};
		const rowStyle = {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			flexWrap: "wrap",
			gap: 12
		};
		const statusStyle = {
			display: "flex",
			alignItems: "center",
			gap: 9,
			fontSize: 14,
			fontWeight: 500,
			color: "var(--dsw-alias-label-primary)"
		};
		const buttonStyle = {
			boxSizing: "border-box",
			minHeight: 34,
			padding: "6px 14px",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 18,
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)",
			font: "inherit",
			fontSize: 14,
			cursor: "pointer"
		};
		const codeStyle = {
			display: "inline-flex",
			alignItems: "center",
			minHeight: 38,
			padding: "0 14px",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 8,
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)",
			fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
			fontSize: 18,
			fontWeight: 700,
			letterSpacing: "0.08em"
		};
		const primaryButtonStyle = {
			...buttonStyle,
			height: 36,
			minHeight: 36,
			padding: "0 14px",
			border: 0,
			background: "var(--dsw-alias-button-primary-fill)",
			color: "var(--dsw-alias-label-primary-foreground)",
			display: "inline-flex",
			alignItems: "center",
			justifyContent: "center",
			lineHeight: "22px"
		};
		const usageStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 10,
			paddingTop: 2
		};
		const usageHeaderStyle = {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 12
		};
		const usageTitleStyle = {
			color: "var(--dsw-alias-label-primary)",
			fontSize: 14,
			fontWeight: 600
		};
		const usageWindowStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 5,
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 12,
			padding: "14px 14px 15px",
			background: "var(--dsw-alias-bg-layer-1)"
		};
		const usageWindowHeaderStyle = {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			flexWrap: "wrap",
			gap: 16
		};
		const usageWindowDetailsStyle = {
			display: "flex",
			minWidth: 0,
			flexDirection: "column",
			gap: 3
		};
		const usageWindowTitleStyle = {
			color: "var(--dsw-alias-label-primary)",
			fontSize: 14,
			fontWeight: 600
		};
		const usageResetStyle = {
			color: "var(--dsw-alias-label-tertiary)",
			fontSize: 12
		};
		const usageRemainingStyle = {
			display: "flex",
			alignItems: "center",
			justifyContent: "flex-end",
			flex: "1 1 220px",
			minWidth: 200,
			gap: 12
		};
		const usageTrackStyle = {
			overflow: "hidden",
			flex: "1 1 140px",
			width: 192,
			minWidth: 100,
			maxWidth: 192,
			height: 8,
			borderRadius: 999,
			background: "var(--dsw-alias-bg-layer-3, rgba(127, 127, 127, 0.28))"
		};
		const usageFillStyle = {
			height: "100%",
			borderRadius: "inherit",
			background: "var(--dsw-alias-brand-primary)",
			transition: "width 160ms ease"
		};
		const usageRemainingTextStyle = {
			color: "var(--dsw-alias-label-secondary)",
			fontSize: 14,
			whiteSpace: "nowrap"
		};
		function Chevron({ open }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				"aria-hidden": "true",
				style: {
					color: "var(--dsw-alias-label-tertiary)",
					transform: open ? "rotate(180deg)" : "none",
					transition: "transform 160ms ease"
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
					width: "14",
					height: "14",
					viewBox: "0 0 14 14",
					fill: "none",
					xmlns: "http://www.w3.org/2000/svg",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M2.15 5.5 3 4.65l3.73 3.73a.38.38 0 0 0 .54 0L11 4.65l.85.85-2.73 2.73c-.58.58-.9.9-1.4 1.03a2.1 2.1 0 0 1-.94 0c-.5-.13-.82-.45-1.4-1.03L2.15 5.5Z",
						fill: "currentColor"
					})
				})
			});
		}
		var AccountRequestError = class extends Error {
			code;
			constructor(code, message) {
				super(message);
				this.code = code;
				this.name = "AccountRequestError";
			}
		};
		async function jsonRequest(path, method = "GET", body) {
			const headers = { accept: "application/json" };
			if (body !== void 0) headers["content-type"] = "application/json";
			const response = await fetch(path, {
				method,
				headers,
				...body === void 0 ? {} : { body: JSON.stringify(body) },
				credentials: "same-origin"
			});
			const value = await response.json().catch(() => void 0);
			if (!response.ok) {
				const code = typeof value === "object" && value !== null && "error" in value && typeof value.error === "string" ? value.error : `HTTP ${response.status}`;
				throw new AccountRequestError(code, code);
			}
			return value;
		}
		function dotStyle(status) {
			return {
				width: 9,
				height: 9,
				borderRadius: "50%",
				flex: "0 0 auto",
				background: status === "signed-in" ? "var(--dsw-alias-state-success-primary, #22a06b)" : status === "error" || status === "remote-web-origin-not-trusted" ? "var(--dsw-alias-state-error-primary, #d92d20)" : status === "signing-in" || status === "loading" ? "var(--dsw-alias-brand-primary, #1677ff)" : "var(--dsw-alias-label-dimmed, #9aa0a6)"
			};
		}
		function percent(value) {
			if (value === void 0 || !Number.isFinite(value)) return "—";
			return `${Math.round(value)}%`;
		}
		function progressWidth(value) {
			if (value === void 0 || !Number.isFinite(value)) return "0%";
			return `${Math.max(0, Math.min(100, value))}%`;
		}
		function weeklyWindow(usage) {
			return [usage.primaryWindow, usage.secondaryWindow].find((window) => window?.limitWindowSeconds === 604800) ?? usage.secondaryWindow;
		}
		function resetLabel(window, t) {
			if (window?.resetAt !== void 0 && Number.isFinite(window.resetAt)) {
				const date = new Intl.DateTimeFormat(void 0, {
					dateStyle: "long",
					timeStyle: "short"
				}).format(/* @__PURE__ */ new Date(window.resetAt * 1e3));
				return `${t("usageResetAt")} ${date}`;
			}
			if (window?.resetAfterSeconds !== void 0 && Number.isFinite(window.resetAfterSeconds)) {
				const minutes = Math.max(1, Math.ceil(window.resetAfterSeconds / 60));
				return `${t("usageResetAfter")}: ${minutes}${t("usageMinutes")}`;
			}
		}
		function UsageWindowView({ label, value, t }) {
			if (value === void 0) return null;
			const reset = resetLabel(value, t);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: usageWindowStyle,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: usageWindowHeaderStyle,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: usageWindowDetailsStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: usageWindowTitleStyle,
							children: label
						}), reset === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: usageResetStyle,
							children: reset
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: usageRemainingStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							role: "progressbar",
							"aria-label": label,
							"aria-valuemin": 0,
							"aria-valuemax": 100,
							"aria-valuenow": value.remainingPercent,
							style: usageTrackStyle,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { style: {
								...usageFillStyle,
								width: progressWidth(value.remainingPercent)
							} })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							style: usageRemainingTextStyle,
							children: [
								t("usageRemaining"),
								" ",
								percent(value.remainingPercent)
							]
						})]
					})]
				})
			});
		}
		/** Render a standalone login/logout card in the rc.7 keyed Plugin slot. */
		function CodexAuthCard({ t, configScope }) {
			if (t === void 0) throw new Error("Codex auth card requires its translation function");
			const [open, setOpen] = (0, react.useState)(false);
			const [status, setStatus] = (0, react.useState)({ status: "loading" });
			const [busy, setBusy] = (0, react.useState)(false);
			const [challenge, setChallenge] = (0, react.useState)();
			const [usage, setUsage] = (0, react.useState)({ status: "hidden" });
			const refreshUsage = (0, react.useCallback)(async () => {
				if (status.status !== "signed-in") return;
				setUsage((current) => current.status === "ready" ? current : { status: "loading" });
				try {
					setUsage({
						status: "ready",
						usage: await jsonRequest(CODEX_USAGE_PATH)
					});
				} catch {
					setUsage({ status: "error" });
				}
			}, [status.status]);
			const refresh = (0, react.useCallback)(async () => {
				try {
					const next = await jsonRequest(CODEX_AUTH_STATUS_PATH);
					setStatus(next);
					if (next.status !== "signing-in") setChallenge(void 0);
				} catch (error) {
					setStatus(error instanceof AccountRequestError && error.code === "remote-web-origin-not-trusted" ? { status: "remote-web-origin-not-trusted" } : {
						status: "error",
						message: error instanceof Error ? error.message : t("requestFailed")
					});
				}
			}, [t]);
			(0, react.useEffect)(() => {
				refresh();
			}, [refresh]);
			(0, react.useEffect)(() => {
				if (status.status !== "signing-in") return;
				const timer = window.setInterval(() => {
					refresh();
				}, 1e3);
				return () => {
					window.clearInterval(timer);
				};
			}, [refresh, status.status]);
			(0, react.useEffect)(() => {
				if (status.status !== "signed-in") {
					setUsage({ status: "hidden" });
					return;
				}
				refreshUsage();
				const timer = window.setInterval(() => {
					refreshUsage();
				}, 6e4);
				return () => {
					window.clearInterval(timer);
				};
			}, [refreshUsage, status.status]);
			const signIn = async () => {
				const popup = window.open("about:blank", "_blank");
				if (popup === null) {
					setStatus({
						status: "error",
						message: t("popupBlocked")
					});
					return;
				}
				popup.opener = null;
				setBusy(true);
				setStatus({ status: "signing-in" });
				setChallenge(void 0);
				try {
					const next = await jsonRequest(CODEX_AUTH_LOGIN_PATH, "POST");
					setChallenge(next);
					popup.location.replace(next.verificationUri);
				} catch (error) {
					popup.close();
					setChallenge(void 0);
					setStatus(error instanceof AccountRequestError && error.code === "remote-web-origin-not-trusted" ? { status: "remote-web-origin-not-trusted" } : {
						status: "error",
						message: error instanceof Error ? error.message : t("requestFailed")
					});
				} finally {
					setBusy(false);
				}
			};
			const signOut = async () => {
				setBusy(true);
				try {
					await jsonRequest(CODEX_AUTH_LOGOUT_PATH, "POST");
					setStatus({ status: "signed-out" });
					setUsage({ status: "hidden" });
					setChallenge(void 0);
				} catch (error) {
					setStatus({
						status: "error",
						message: error instanceof Error ? error.message : t("requestFailed")
					});
				} finally {
					setBusy(false);
				}
			};
			const label = status.status === "signed-in" ? t("signedIn") : status.status === "loading" ? t("loading") : status.status === "signing-in" ? t("signingIn") : status.status === "remote-web-origin-not-trusted" ? t("remoteOrigin") : status.status === "error" ? t("requestFailed") : t("signedOut");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				style: {
					...cardStyle,
					...open ? cardOpenStyle : {}
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					style: headerStyle,
					"aria-expanded": open,
					"aria-label": `${t(open ? "collapse" : "expand")}: ${t("title")}`,
					onClick: () => {
						setOpen(!open);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						style: headTextStyle,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: nameStyle,
							children: t("title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: descriptionStyle,
							children: t("intro")
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Chevron, { open })]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: cardBodyStyle,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: rowStyle,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: statusStyle,
								role: "status",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									"aria-hidden": "true",
									style: dotStyle(status.status)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label })]
							}), status.status === "loading" || status.status === "remote-web-origin-not-trusted" ? null : status.status === "signed-in" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: buttonStyle,
								disabled: busy,
								onClick: () => {
									signOut();
								},
								children: busy ? t("working") : t("signOut")
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								style: primaryButtonStyle,
								disabled: busy,
								onClick: () => {
									signIn();
								},
								children: busy ? t("working") : t("signIn")
							})]
						}),
						status.status === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: errorStyle,
							children: status.message
						}) : null,
						status.status === "remote-web-origin-not-trusted" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							style: errorStyle,
							children: t("remoteOrigin")
						}) : null,
						usage.status !== "hidden" && status.status === "signed-in" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: usageStyle,
							"aria-label": t("usageTitle"),
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: usageHeaderStyle,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: usageTitleStyle,
										children: t("usageTitle")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										style: {
											...buttonStyle,
											minHeight: 28,
											padding: "3px 10px",
											fontSize: 12
										},
										onClick: () => {
											refreshUsage();
										},
										children: t("refreshUsage")
									})]
								}),
								usage.status === "loading" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: bodyStyle,
									children: t("usageLoading")
								}) : null,
								usage.status === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: errorStyle,
									children: t("usageUnavailable")
								}) : null,
								usage.status === "ready" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(UsageWindowView, {
									label: t("usageWeekly"),
									value: weeklyWindow(usage.usage),
									t
								}), weeklyWindow(usage.usage) === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									style: bodyStyle,
									children: t("usageNoWindow")
								}) : null] }) : null
							]
						}) : null,
						status.status === "signing-in" && challenge !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								flexDirection: "column",
								gap: 8
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								style: bodyStyle,
								children: t("authorizationCodeHelp")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									alignItems: "center",
									flexWrap: "wrap",
									gap: 8
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
									"aria-label": t("authorizationCodeLabel"),
									style: codeStyle,
									children: challenge.userCode
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
									href: challenge.verificationUri,
									target: "_blank",
									rel: "noreferrer",
									style: {
										...buttonStyle,
										display: "inline-flex",
										alignItems: "center",
										textDecoration: "none"
									},
									children: t("openAuthorization")
								})]
							})]
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CodexCapabilities, {
							scope: configScope,
							t
						})
					]
				}) : null]
			});
		}
		//#endregion
		//#region src/settings-contract.ts
		const DEFAULT_CODEX_AUTH_SETTINGS = Object.freeze({
			enableImageTool: false,
			enableImageUpload: false
		});
		function isRecord(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		/** Narrow the settings wire payload before it enters React state. */
		function decodeCodexAuthSettings(value) {
			if (!isRecord(value) || typeof value["enableImageTool"] !== "boolean") return void 0;
			return {
				enableImageTool: value["enableImageTool"],
				enableImageUpload: typeof value["enableImageUpload"] === "boolean" ? value["enableImageUpload"] : DEFAULT_CODEX_AUTH_SETTINGS.enableImageUpload
			};
		}
		//#endregion
		//#region src/client/model-editor-presentation.ts
		/** Keep Codex-specific fields out of the generic pi-ai editor. */
		const CODEX_EDITOR_ATTRIBUTE = "data-dsh-codex-auth-editor";
		const CODEX_ROUTE = "openai-codex";
		const CODEX_PICKER_ATTRIBUTE = "data-dsh-codex-model-picker";
		const SELECT_ALL_ATTRIBUTE = "data-dsh-codex-select-all";
		const ADD_BUTTON_ATTRIBUTE = "data-dsh-codex-add-models";
		const REMOVE_MANUAL_ADD_ATTRIBUTE = "data-dsh-codex-remove-manual-add";
		const PICKER_SELECTION_SYNCED_ATTRIBUTE = "data-dsh-codex-selection-synced";
		const MODEL_ACTION_ATTRIBUTE = "data-dsh-codex-model-action";
		const MODEL_DETAILS_ATTRIBUTE = "data-dsh-codex-model-details";
		const STYLE_ID = "dsh-codex-auth-model-editor";
		const FETCH_MODEL_LABELS = /* @__PURE__ */ new Set([
			"获取可用模型",
			"获取模型",
			"Fetch available models",
			"Fetch models"
		]);
		const MODEL_ACTION_LABELS = /* @__PURE__ */ new Map([
			["获取可用模型", {
				action: "fetch",
				replacement: "获取模型"
			}],
			["获取模型", {
				action: "fetch",
				replacement: "获取模型"
			}],
			["Fetch available models", {
				action: "fetch",
				replacement: "Fetch models"
			}],
			["Fetch models", {
				action: "fetch",
				replacement: "Fetch models"
			}],
			["恢复默认模型", {
				action: "reset",
				replacement: "恢复模型"
			}],
			["恢复模型", {
				action: "reset",
				replacement: "恢复模型"
			}],
			["Restore defaults", {
				action: "reset",
				replacement: "Restore models"
			}],
			["Restore models", {
				action: "reset",
				replacement: "Restore models"
			}]
		]);
		const PICKER_TITLE_LABELS = /* @__PURE__ */ new Set([
			"选择要添加的模型",
			"模型列表",
			"Select models to add",
			"Model list"
		]);
		const ADD_MODEL_LABELS = /* @__PURE__ */ new Set([
			"添加所选",
			"确定",
			"Add selected",
			"Confirm"
		]);
		const MANUAL_ADD_MODEL_LABELS = /* @__PURE__ */ new Set(["添加模型", "Add model"]);
		const REMOVE_MODEL_LABELS = [
			"移除模型",
			"删除模型",
			"Remove model",
			"Delete model"
		];
		/** Defaults from the installed pi-ai openai-codex catalog (0.82.1). */
		const CODEX_MODEL_DEFAULTS = {
			"gpt-5.3-codex-spark": {
				contextWindow: 128e3,
				maxTokens: 128e3
			},
			"gpt-5.4": {
				contextWindow: 272e3,
				maxTokens: 128e3
			},
			"gpt-5.4-mini": {
				contextWindow: 272e3,
				maxTokens: 128e3
			},
			"gpt-5.5": {
				contextWindow: 272e3,
				maxTokens: 128e3
			},
			"gpt-5.6-luna": {
				contextWindow: 272e3,
				maxTokens: 128e3
			},
			"gpt-5.6-sol": {
				contextWindow: 272e3,
				maxTokens: 128e3
			},
			"gpt-5.6-terra": {
				contextWindow: 272e3,
				maxTokens: 128e3
			}
		};
		const MODEL_ID_LABELS = ["模型 ID", "Model ID"];
		const MODEL_NAME_LABELS = [
			"显示名称",
			"Display name",
			"模型名称",
			"Model name"
		];
		const MODEL_READONLY_LABELS = [...MODEL_ID_LABELS, ...MODEL_NAME_LABELS];
		const MODEL_CONTEXT_LABELS = ["上下文窗口", "Context window"];
		const MODEL_MAX_TOKENS_LABELS = ["最大输出 token", "Max output tokens"];
		function labelOf(input) {
			return input.getAttribute("aria-label")?.trim() ?? "";
		}
		function startsWithAny(value, prefixes) {
			return prefixes.some((prefix) => value.startsWith(prefix));
		}
		function rowNumberOf(input) {
			const match = labelOf(input).match(/(\d+)$/u);
			if (match === null) return void 0;
			const value = Number(match[1]);
			return Number.isInteger(value) && value > 0 ? value : void 0;
		}
		function formatCapacity(value) {
			return value % 1e3 === 0 ? `${value / 1e3}K` : String(value);
		}
		function modelIdInputs(editor) {
			return [...editor.querySelectorAll("input")].filter((input) => startsWithAny(labelOf(input), MODEL_ID_LABELS));
		}
		function modelIds(editor) {
			return new Set(modelIdInputs(editor).map((input) => input.value.trim()).filter((value) => value.length > 0));
		}
		function candidateId(input) {
			const label = input.closest("label");
			const value = input.nextElementSibling?.textContent?.trim() || label?.querySelector("span")?.textContent?.trim();
			return value === void 0 || value.length === 0 ? void 0 : value;
		}
		/**
		* The official Models page intentionally shares one pi-ai editor between all
		* providers. Codex gets its endpoint and credential from OAuth, so those two
		* generic inputs would be misleading. Mark only the Codex editor and hide the
		* corresponding field wrappers; the model catalog remains the official editor.
		*/
		function installCodexModelEditorPresentation() {
			const style = document.createElement("style");
			style.id = STYLE_ID;
			style.textContent = `
[${CODEX_EDITOR_ATTRIBUTE}="true"] div:has(> input[aria-label="API 密钥"]),
[${CODEX_EDITOR_ATTRIBUTE}="true"] div:has(> input[aria-label="API Key"]),
[${CODEX_EDITOR_ATTRIBUTE}="true"] div:has(> input[aria-label="API 地址"]),
[${CODEX_EDITOR_ATTRIBUTE}="true"] div:has(> input[aria-label="API URL"]) {
  display: none !important;
}

[${CODEX_PICKER_ATTRIBUTE}="true"] [${ADD_BUTTON_ATTRIBUTE}="true"] {
  border: 0 !important;
  background: var(--dsw-alias-button-primary-fill) !important;
  color: var(--dsw-alias-label-primary-foreground) !important;
}

[${CODEX_PICKER_ATTRIBUTE}="true"] [${ADD_BUTTON_ATTRIBUTE}="true"]:hover:not(:disabled) {
  background: var(--dsw-alias-button-primary-hover) !important;
}

[${CODEX_EDITOR_ATTRIBUTE}="true"] [${REMOVE_MANUAL_ADD_ATTRIBUTE}="true"] {
  display: none !important;
}

[${CODEX_EDITOR_ATTRIBUTE}="true"] [${MODEL_DETAILS_ATTRIBUTE}="true"] > summary {
  display: none !important;
}

[${CODEX_EDITOR_ATTRIBUTE}="true"] [${MODEL_DETAILS_ATTRIBUTE}="true"] {
  display: contents !important;
  border: 0 !important;
  padding: 0 !important;
}

[${CODEX_EDITOR_ATTRIBUTE}="true"] [${MODEL_DETAILS_ATTRIBUTE}="true"] > :not(summary) {
  display: contents !important;
  border: 0 !important;
  padding: 0 !important;
}

[${CODEX_EDITOR_ATTRIBUTE}="true"] [${MODEL_DETAILS_ATTRIBUTE}="true"] > :not(summary) > section[aria-label="模型目录"],
[${CODEX_EDITOR_ATTRIBUTE}="true"] [${MODEL_DETAILS_ATTRIBUTE}="true"] > :not(summary) > section[aria-label="Models"] {
  border-top: 0 !important;
  padding-top: 0 !important;
}

[${CODEX_EDITOR_ATTRIBUTE}="true"] [${MODEL_DETAILS_ATTRIBUTE}="true"]:not([open]) > :not(summary) {
  display: contents !important;
}

[${CODEX_EDITOR_ATTRIBUTE}="true"] [${MODEL_ACTION_ATTRIBUTE}="fetch"],
[${CODEX_EDITOR_ATTRIBUTE}="true"] [${MODEL_ACTION_ATTRIBUTE}="reset"] {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 16px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
}

[${CODEX_EDITOR_ATTRIBUTE}="true"] [${MODEL_ACTION_ATTRIBUTE}="fetch"]:hover:not(:disabled),
[${CODEX_EDITOR_ATTRIBUTE}="true"] [${MODEL_ACTION_ATTRIBUTE}="reset"]:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover-solid);
}

[${CODEX_EDITOR_ATTRIBUTE}="true"] [${MODEL_ACTION_ATTRIBUTE}="fetch"]:disabled,
[${CODEX_EDITOR_ATTRIBUTE}="true"] [${MODEL_ACTION_ATTRIBUTE}="reset"]:disabled {
  opacity: 0.4;
  cursor: default;
}

[${CODEX_EDITOR_ATTRIBUTE}="true"] div:has(> [${MODEL_ACTION_ATTRIBUTE}="fetch"]),
[${CODEX_EDITOR_ATTRIBUTE}="true"] div:has(> [${MODEL_ACTION_ATTRIBUTE}="reset"]) {
  justify-content: flex-start;
  align-items: center;
  gap: 15px;
}

[${CODEX_EDITOR_ATTRIBUTE}="true"] div:has(> [${MODEL_ACTION_ATTRIBUTE}="reset"]) > [${MODEL_ACTION_ATTRIBUTE}="reset"],
[${CODEX_EDITOR_ATTRIBUTE}="true"] div:not(:has(> [${MODEL_ACTION_ATTRIBUTE}="reset"])):has(> [${MODEL_ACTION_ATTRIBUTE}="fetch"]) > [${MODEL_ACTION_ATTRIBUTE}="fetch"] {
  margin-left: auto;
}

[${CODEX_PICKER_ATTRIBUTE}="true"] [${SELECT_ALL_ATTRIBUTE}="true"] {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  color: var(--dsw-alias-label-primary);
  cursor: pointer;
}

[${CODEX_PICKER_ATTRIBUTE}="true"] input[type="checkbox"] {
  flex: none;
  width: 16px;
  height: 16px;
  margin: 3px 0 0;
  accent-color: var(--dsw-alias-button-primary-fill);
  cursor: pointer;
}

[${CODEX_PICKER_ATTRIBUTE}="true"] input[type="checkbox"]:focus-visible {
  outline: 2px solid var(--dsw-alias-border-l4);
  outline-offset: 2px;
}

[${CODEX_PICKER_ATTRIBUTE}="true"] input[type="checkbox"]:disabled {
  cursor: default;
}
`;
			document.head.appendChild(style);
			let codexPickerPending = false;
			const originalPlaceholders = /* @__PURE__ */ new Map();
			const originalModelNameAttributes = /* @__PURE__ */ new Map();
			const originalModelActionMarkup = /* @__PURE__ */ new Map();
			const originalModelDetailsOpen = /* @__PURE__ */ new Map();
			const originalPickerCopy = /* @__PURE__ */ new Map();
			let pickerConfirmWorking = false;
			let pickerConfirmReplay = false;
			const restoreModelNameInput = (input, original) => {
				input.readOnly = original.readOnly;
				if (original.ariaReadOnly === null) input.removeAttribute("aria-readonly");
				else input.setAttribute("aria-readonly", original.ariaReadOnly);
			};
			const markModelNameInputsReadonly = () => {
				const current = /* @__PURE__ */ new Set();
				for (const input of document.querySelectorAll("input")) {
					if (!startsWithAny(labelOf(input), MODEL_READONLY_LABELS)) continue;
					current.add(input);
					if (!originalModelNameAttributes.has(input)) originalModelNameAttributes.set(input, {
						readOnly: input.readOnly,
						ariaReadOnly: input.getAttribute("aria-readonly")
					});
					input.readOnly = true;
					input.setAttribute("aria-readonly", "true");
				}
				for (const [input, original] of originalModelNameAttributes) {
					if (current.has(input)) continue;
					restoreModelNameInput(input, original);
					originalModelNameAttributes.delete(input);
				}
			};
			const markManualAddButtons = (editor) => {
				for (const button of editor.querySelectorAll("button")) if (MANUAL_ADD_MODEL_LABELS.has(button.textContent?.trim() ?? "")) button.setAttribute(REMOVE_MANUAL_ADD_ATTRIBUTE, "true");
				else button.removeAttribute(REMOVE_MANUAL_ADD_ATTRIBUTE);
			};
			const restoreModelActionButtons = (editor) => {
				for (const [button, original] of originalModelActionMarkup) {
					if (!editor.contains(button)) continue;
					button.innerHTML = original.html;
					button.removeAttribute(MODEL_ACTION_ATTRIBUTE);
					originalModelActionMarkup.delete(button);
				}
			};
			const markModelActionButtons = (editor) => {
				const active = /* @__PURE__ */ new Set();
				for (const button of editor.querySelectorAll("button")) {
					const original = originalModelActionMarkup.get(button);
					const sourceLabel = original?.label ?? button.textContent?.trim() ?? "";
					const action = MODEL_ACTION_LABELS.get(sourceLabel);
					if (action === void 0) continue;
					if (original === void 0) originalModelActionMarkup.set(button, {
						label: sourceLabel,
						html: button.innerHTML
					});
					active.add(button);
					button.setAttribute(MODEL_ACTION_ATTRIBUTE, action.action);
					if (button.textContent !== action.replacement) button.textContent = action.replacement;
				}
				for (const [button, original] of originalModelActionMarkup) {
					if (active.has(button)) continue;
					if (editor.contains(button)) {
						button.innerHTML = original.html;
						button.removeAttribute(MODEL_ACTION_ATTRIBUTE);
					}
					originalModelActionMarkup.delete(button);
				}
			};
			const restoreCapacityPlaceholders = (editor) => {
				for (const [input, placeholder] of originalPlaceholders) {
					if (!editor.contains(input)) continue;
					input.placeholder = placeholder;
					originalPlaceholders.delete(input);
				}
			};
			const markOfficialCapacityPlaceholders = (editor) => {
				const idsByRow = /* @__PURE__ */ new Map();
				for (const input of modelIdInputs(editor)) {
					const row = rowNumberOf(input);
					const id = input.value.trim();
					if (row !== void 0 && id.length > 0) idsByRow.set(row, id);
				}
				for (const input of editor.querySelectorAll("input")) {
					const row = rowNumberOf(input);
					if (row === void 0) continue;
					const label = labelOf(input);
					const field = startsWithAny(label, MODEL_CONTEXT_LABELS) ? "contextWindow" : startsWithAny(label, MODEL_MAX_TOKENS_LABELS) ? "maxTokens" : void 0;
					if (field === void 0) continue;
					const defaults = CODEX_MODEL_DEFAULTS[idsByRow.get(row) ?? ""];
					if (defaults === void 0) {
						if (originalPlaceholders.has(input)) {
							input.placeholder = originalPlaceholders.get(input) ?? "";
							originalPlaceholders.delete(input);
						}
						continue;
					}
					if (!originalPlaceholders.has(input)) originalPlaceholders.set(input, input.placeholder);
					input.placeholder = formatCapacity(defaults[field]);
				}
			};
			const restoreModelDetails = (editor) => {
				for (const [details, originalOpen] of originalModelDetailsOpen) {
					if (!editor.contains(details)) continue;
					details.open = originalOpen;
					details.removeAttribute(MODEL_DETAILS_ATTRIBUTE);
					originalModelDetailsOpen.delete(details);
				}
			};
			const markModelDetails = (editor) => {
				const details = editor.querySelector("section[aria-label=\"模型目录\"], section[aria-label=\"Models\"]")?.closest("details") ?? [...editor.querySelectorAll("details")].find((candidate) => modelIdInputs(candidate).length > 0);
				if (details === void 0) {
					restoreModelDetails(editor);
					return;
				}
				if (!originalModelDetailsOpen.has(details)) originalModelDetailsOpen.set(details, details.open);
				details.setAttribute(MODEL_DETAILS_ATTRIBUTE, "true");
				details.open = true;
				for (const [other, originalOpen] of originalModelDetailsOpen) {
					if (other === details || !editor.contains(other)) continue;
					other.open = originalOpen;
					other.removeAttribute(MODEL_DETAILS_ATTRIBUTE);
					originalModelDetailsOpen.delete(other);
				}
			};
			const markEditors = () => {
				const matched = /* @__PURE__ */ new Set();
				for (const route of document.querySelectorAll("span")) {
					if (route.textContent?.trim() !== CODEX_ROUTE) continue;
					const editor = route.parentElement?.parentElement;
					if (editor === null || editor === void 0) continue;
					if (!editor.querySelector("input[aria-label=\"API 密钥\"], input[aria-label=\"API Key\"]")) continue;
					matched.add(editor);
					if (editor.getAttribute(CODEX_EDITOR_ATTRIBUTE) !== "true") editor.setAttribute(CODEX_EDITOR_ATTRIBUTE, "true");
					markManualAddButtons(editor);
					markModelActionButtons(editor);
					markOfficialCapacityPlaceholders(editor);
					markModelDetails(editor);
				}
				for (const editor of document.querySelectorAll(`[${CODEX_EDITOR_ATTRIBUTE}]`)) if (!matched.has(editor)) {
					editor.removeAttribute(CODEX_EDITOR_ATTRIBUTE);
					markManualAddButtons(editor);
					restoreModelActionButtons(editor);
					restoreCapacityPlaceholders(editor);
					restoreModelDetails(editor);
				}
			};
			const pickerIsChinese = (dialog) => {
				const original = originalPickerCopy.get(dialog);
				return original?.ariaLabel === "选择要添加的模型" || original?.title === "选择要添加的模型" || dialog.getAttribute("aria-label") === "模型列表";
			};
			const isModelPicker = (dialog) => {
				if (dialog.getAttribute(CODEX_PICKER_ATTRIBUTE) === "true") return true;
				const label = dialog.getAttribute("aria-label")?.trim();
				return label !== void 0 && PICKER_TITLE_LABELS.has(label);
			};
			const pickerSelectedModelIds = (dialog) => {
				const candidateList = dialog.querySelector("ul");
				if (candidateList === null) return /* @__PURE__ */ new Set();
				return new Set([...candidateList.querySelectorAll("input[type=\"checkbox\"]")].filter((input) => input.checked).map(candidateId).filter((id) => id !== void 0 && id.length > 0));
			};
			const removeButtonForModelInput = (input) => {
				const row = input.parentElement;
				if (row === null) return void 0;
				return [...row.querySelectorAll("button")].find((button) => REMOVE_MODEL_LABELS.some((label) => (button.getAttribute("aria-label") ?? "").trim().startsWith(label)));
			};
			const uncheckedModelRows = (dialog) => {
				const editor = document.querySelector(`[${CODEX_EDITOR_ATTRIBUTE}="true"]`);
				if (editor === null) return [];
				const selected = pickerSelectedModelIds(dialog);
				return modelIdInputs(editor).map((input, index) => ({
					input,
					index,
					id: input.value.trim(),
					remove: removeButtonForModelInput(input)
				})).filter((row) => !selected.has(row.id) && row.remove !== void 0).sort((left, right) => right.index - left.index).map(({ input, remove }) => ({
					input,
					remove
				}));
			};
			const waitForPickerRender = () => new Promise((resolve) => {
				window.setTimeout(resolve, 0);
			});
			/** Remove unchecked rows one at a time so each React draft update is committed before the next one. */
			const removeUncheckedModelRows = async (dialog) => {
				let removed = false;
				for (let attempt = 0; attempt < 128; attempt += 1) {
					const next = uncheckedModelRows(dialog)[0];
					if (next === void 0) return removed;
					if (next.remove.disabled || !next.remove.isConnected) return removed;
					next.remove.click();
					removed = true;
					await waitForPickerRender();
				}
				return removed;
			};
			const isPickerConfirmButton = (button) => {
				const dialog = button.closest("[role=\"dialog\"]");
				if (dialog === null || dialog.getAttribute(CODEX_PICKER_ATTRIBUTE) !== "true") return false;
				return button.getAttribute(ADD_BUTTON_ATTRIBUTE) === "true" || ADD_MODEL_LABELS.has(button.textContent?.trim() ?? "");
			};
			const isCodexFetchButton = (button) => {
				if (button.getAttribute(MODEL_ACTION_ATTRIBUTE) === "fetch") return true;
				if (!FETCH_MODEL_LABELS.has(button.textContent?.trim() ?? "")) return false;
				return button.closest(`[${CODEX_EDITOR_ATTRIBUTE}="true"]`) !== null;
			};
			const syncPickerSelection = (dialog, candidateList) => {
				if (dialog.getAttribute(PICKER_SELECTION_SYNCED_ATTRIBUTE) === "true") return true;
				const editor = document.querySelector(`[${CODEX_EDITOR_ATTRIBUTE}="true"]`);
				if (editor === null) return false;
				const candidates = [...candidateList.querySelectorAll("input[type=\"checkbox\"]")];
				if (candidates.length === 0) return false;
				const configured = modelIds(editor);
				for (const candidate of candidates) {
					const id = candidateId(candidate);
					if (id === void 0) return false;
					const shouldBeChecked = configured.has(id);
					if (candidate.checked !== shouldBeChecked) candidate.click();
				}
				dialog.setAttribute(PICKER_SELECTION_SYNCED_ATTRIBUTE, "true");
				return true;
			};
			const enhancePicker = (dialog) => {
				if (!isModelPicker(dialog)) return;
				dialog.setAttribute(CODEX_PICKER_ATTRIBUTE, "true");
				const original = originalPickerCopy.get(dialog) ?? {
					ariaLabel: dialog.getAttribute("aria-label"),
					title: dialog.querySelector("h2")?.textContent ?? null,
					description: dialog.querySelector("p")?.textContent ?? null
				};
				if (!originalPickerCopy.has(dialog)) originalPickerCopy.set(dialog, original);
				const chinese = pickerIsChinese(dialog);
				const title = chinese ? "模型列表" : "Model list";
				const description = chinese ? "请选择需要保留的模型；未勾选的模型将从模型目录移除。" : "Select the models to keep; unchecked models will be removed from the model catalog.";
				if (dialog.getAttribute("aria-label") !== title) dialog.setAttribute("aria-label", title);
				const heading = dialog.querySelector("h2");
				if (heading !== null && heading.textContent !== title) heading.textContent = title;
				const descriptionNode = dialog.querySelector("p");
				if (descriptionNode !== null && descriptionNode.textContent !== description) descriptionNode.textContent = description;
				const candidateList = dialog.querySelector("ul");
				if (candidateList === null) return;
				syncPickerSelection(dialog, candidateList);
				let selectAll = dialog.querySelector(`[${SELECT_ALL_ATTRIBUTE}="true"]`);
				if (selectAll === null) {
					const wrapper = document.createElement("label");
					wrapper.setAttribute(SELECT_ALL_ATTRIBUTE, "true");
					selectAll = document.createElement("input");
					selectAll.type = "checkbox";
					selectAll.setAttribute("aria-label", chinese ? "全选" : "Select all");
					const label = document.createElement("span");
					label.textContent = chinese ? "全选" : "Select all";
					wrapper.append(selectAll, label);
					candidateList.before(wrapper);
					selectAll.addEventListener("change", () => {
						const checked = selectAll?.checked ?? false;
						for (const candidate of candidateList.querySelectorAll("input[type=\"checkbox\"]")) if (candidate.checked !== checked) candidate.click();
						window.setTimeout(syncSelectAll, 0);
					});
				}
				const syncSelectAll = () => {
					if (selectAll === null) return;
					const candidates = [...candidateList.querySelectorAll("input[type=\"checkbox\"]")];
					const selected = candidates.filter((candidate) => candidate.checked).length;
					selectAll.disabled = candidates.length === 0;
					selectAll.checked = candidates.length > 0 && selected === candidates.length;
					selectAll.indeterminate = selected > 0 && selected < candidates.length;
				};
				if (candidateList.dataset.dshCodexSelectAllBound !== "true") {
					candidateList.dataset.dshCodexSelectAllBound = "true";
					candidateList.addEventListener("change", syncSelectAll);
				}
				syncSelectAll();
				const addButton = dialog.querySelector(`[${ADD_BUTTON_ATTRIBUTE}="true"]`) ?? [...dialog.querySelectorAll("button")].find((button) => ADD_MODEL_LABELS.has(button.textContent?.trim() ?? ""));
				if (addButton !== void 0) {
					addButton.setAttribute(ADD_BUTTON_ATTRIBUTE, "true");
					const replacement = chinese ? "确定" : "Confirm";
					if (addButton.textContent !== replacement) addButton.textContent = replacement;
				}
			};
			const updatePickers = () => {
				markModelNameInputsReadonly();
				markEditors();
				for (const [dialog] of originalPickerCopy) if (!document.contains(dialog)) originalPickerCopy.delete(dialog);
				const dialogs = [...document.querySelectorAll("[role=\"dialog\"]")];
				const activePicker = dialogs.find(isModelPicker);
				if (activePicker !== void 0 && codexPickerPending) {
					enhancePicker(activePicker);
					codexPickerPending = false;
				}
				for (const dialog of dialogs) if (dialog.getAttribute(CODEX_PICKER_ATTRIBUTE) === "true") enhancePicker(dialog);
			};
			const onClick = (event) => {
				const target = event.target;
				if (!(target instanceof Element)) return;
				const button = target.closest("button");
				if (button !== null && isPickerConfirmButton(button)) {
					if (pickerConfirmReplay) {
						pickerConfirmReplay = false;
						return;
					}
					if (pickerConfirmWorking) {
						event.preventDefault();
						event.stopPropagation();
						return;
					}
					const dialog = button.closest("[role=\"dialog\"]");
					if (dialog !== null && uncheckedModelRows(dialog).length > 0) {
						event.preventDefault();
						event.stopPropagation();
						pickerConfirmWorking = true;
						removeUncheckedModelRows(dialog).then((removed) => {
							pickerConfirmWorking = false;
							if (!removed) return;
							window.setTimeout(() => {
								const current = dialog.querySelector(`[${ADD_BUTTON_ATTRIBUTE}="true"]`) ?? [...dialog.querySelectorAll("button")].find((candidate) => ADD_MODEL_LABELS.has(candidate.textContent?.trim() ?? ""));
								if (current === null || current === void 0 || current.disabled) return;
								current.setAttribute(ADD_BUTTON_ATTRIBUTE, "true");
								pickerConfirmReplay = true;
								current.click();
							}, 0);
						}, () => {
							pickerConfirmWorking = false;
						});
						return;
					}
				}
				if (button !== null && isCodexFetchButton(button)) {
					codexPickerPending = true;
					window.setTimeout(updatePickers, 0);
				}
			};
			markEditors();
			updatePickers();
			document.addEventListener("click", onClick, true);
			const observer = new MutationObserver(updatePickers);
			observer.observe(document.body, {
				childList: true,
				subtree: true
			});
			return () => {
				observer.disconnect();
				document.removeEventListener("click", onClick, true);
				document.getElementById(STYLE_ID)?.remove();
				for (const editor of document.querySelectorAll(`[${CODEX_EDITOR_ATTRIBUTE}]`)) {
					editor.removeAttribute(CODEX_EDITOR_ATTRIBUTE);
					restoreModelDetails(editor);
				}
				originalModelDetailsOpen.clear();
				for (const dialog of document.querySelectorAll(`[${CODEX_PICKER_ATTRIBUTE}]`)) {
					dialog.removeAttribute(CODEX_PICKER_ATTRIBUTE);
					dialog.removeAttribute(PICKER_SELECTION_SYNCED_ATTRIBUTE);
				}
				for (const [dialog, original] of originalPickerCopy) {
					if (original.ariaLabel === null) dialog.removeAttribute("aria-label");
					else dialog.setAttribute("aria-label", original.ariaLabel);
					const heading = dialog.querySelector("h2");
					if (heading !== null && original.title !== null) heading.textContent = original.title;
					const description = dialog.querySelector("p");
					if (description !== null && original.description !== null) description.textContent = original.description;
				}
				originalPickerCopy.clear();
				for (const button of document.querySelectorAll(`[${REMOVE_MANUAL_ADD_ATTRIBUTE}]`)) button.removeAttribute(REMOVE_MANUAL_ADD_ATTRIBUTE);
				for (const [button, original] of originalModelActionMarkup) {
					button.innerHTML = original.html;
					button.removeAttribute(MODEL_ACTION_ATTRIBUTE);
				}
				originalModelActionMarkup.clear();
				for (const [input, placeholder] of originalPlaceholders) input.placeholder = placeholder;
				originalPlaceholders.clear();
				for (const [input, original] of originalModelNameAttributes) restoreModelNameInput(input, original);
				originalModelNameAttributes.clear();
			};
		}
		//#endregion
		//#region src/client/remote-settings-scope.ts
		const INITIAL_SNAPSHOT = {
			status: "loading",
			value: void 0,
			base: void 0,
			user: void 0,
			revision: void 0,
			writable: false,
			mode: "host"
		};
		async function requestSettings(method, value) {
			const response = await fetch(CODEX_AUTH_SETTINGS_PATH, {
				method,
				headers: {
					accept: "application/json",
					...value === void 0 ? {} : { "content-type": "application/json" }
				},
				...value === void 0 ? {} : { body: JSON.stringify(value) },
				credentials: "same-origin"
			});
			const payload = await response.json().catch(() => void 0);
			if (!response.ok) {
				const error = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" ? payload.error : `HTTP ${String(response.status)}`;
				throw new Error(error);
			}
			const settings = decodeCodexAuthSettings(payload);
			if (settings === void 0) throw new Error("Host returned invalid Codex settings");
			return settings;
		}
		/**
		* The official settings RPC is intentionally unavailable to non-loopback
		* browser authorities. This small scope talks only to the plugin-owned,
		* same-origin endpoint and carries no settings schema or credential data.
		*/
		var CodexAuthRemoteSettingsScope = class {
			snapshot = INITIAL_SNAPSHOT;
			listeners = /* @__PURE__ */ new Set();
			tail = Promise.resolve();
			disposed = false;
			getSnapshot() {
				return this.snapshot;
			}
			subscribe(listener) {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			}
			load() {
				return this.enqueue(async () => {
					try {
						const settings = await requestSettings("GET");
						if (this.disposed) return;
						this.publish({
							...this.snapshot,
							status: "ready",
							value: settings,
							writable: true
						});
					} catch {
						if (this.disposed) return;
						this.publish({
							...this.snapshot,
							status: "unavailable",
							writable: false
						});
					}
				});
			}
			set(field, value) {
				if (field !== "enableImageTool" && field !== "enableImageUpload") return Promise.reject(/* @__PURE__ */ new Error(`Unsupported Codex settings field: ${field}`));
				if (typeof value !== "boolean") return Promise.reject(/* @__PURE__ */ new TypeError(`Codex setting ${field} must be boolean`));
				return this.enqueue(async () => {
					const current = this.getSnapshot().value;
					if (current === void 0) throw new Error("Codex settings are not loaded");
					const accepted = await requestSettings("PUT", {
						...current,
						[field]: value
					});
					if (this.disposed) return;
					this.publish({
						...this.snapshot,
						status: "ready",
						value: accepted,
						writable: true
					});
				});
			}
			unset(field) {
				return this.set(field, false);
			}
			async dispose() {
				this.disposed = true;
				await this.tail;
			}
			enqueue(operation) {
				if (this.disposed) return Promise.resolve();
				const task = this.tail.then(async () => {
					if (this.disposed) return;
					await operation();
				});
				this.tail = task.catch(() => void 0);
				return task;
			}
			publish(next) {
				this.snapshot = next;
				for (const listener of [...this.listeners]) listener();
			}
		};
		//#endregion
		//#region src/client/locales.ts
		/** Browser copy for the standalone Codex authentication card. */
		const en = {
			title: "Codex Auth",
			intro: "Sign in with your ChatGPT account for Codex-compatible plugins.",
			expand: "Expand settings",
			collapse: "Collapse settings",
			loading: "Loading account…",
			signedOut: "Not signed in",
			signingIn: "Waiting for Codex authorization…",
			signedIn: "Signed in",
			signIn: "Sign in with ChatGPT",
			signOut: "Sign out",
			working: "Working…",
			popupBlocked: "The browser blocked the sign-in window. Allow pop-ups for this dsh page and retry.",
			requestFailed: "The Codex account request failed.",
			remoteOrigin: "This browser origin is not trusted by the DSH Web server.",
			authorizationCodeHelp: "The plugin generated a one-time authorization code. Enter it on the opened Codex authorization page; no workspace selection is required.",
			authorizationCodeLabel: "Codex authorization code",
			openAuthorization: "Open authorization page",
			usageTitle: "General usage limits",
			refreshUsage: "Refresh",
			usageLoading: "Loading usage…",
			usageUnavailable: "Usage information is temporarily unavailable.",
			usagePlan: "Plan",
			usageAvailable: "Available",
			usageLimitReached: "Limit reached",
			usageUnlimited: "Unlimited credits",
			usageBalance: "Credit balance",
			usagePrimary: "Primary window",
			usageSecondary: "Usage window",
			usageWeekly: "Weekly usage limit",
			usageRemaining: "Remaining",
			usageResetAt: "Reset time:",
			usageResetAfter: "Resets in",
			usageMinutes: " min",
			usageNoWindow: "No weekly usage information is available.",
			capabilitiesTitle: "Image capabilities",
			capabilitiesIntro: "Optional image features for the Codex model route.",
			enableImageRecognition: "Enable image recognition",
			enableImageRecognitionHelp: "Adds view_image so image-capable Codex models can inspect approved local images.",
			enableImageUpload: "Enable image upload",
			enableImageUploadHelp: "Allow image-capable Codex models to receive images pasted or dropped into the conversation.",
			enableImageGeneration: "Enable image generation",
			imageGenerationUnavailableHelp: "Not supported by the Codex provider and DSH rc.7 model adapter.",
			settingsLoading: "Loading plugin settings…",
			settingsUnavailable: "Plugin settings are unavailable in this dsh profile.",
			settingsReadOnly: "This profile exposes plugin settings as read-only.",
			settingsSaved: "Saved",
			settingsSaveFailed: "Unable to save settings.",
			discard: "Discard",
			save: "Save",
			saving: "Saving…"
		};
		const zh = {
			title: "Codex Auth",
			intro: "使用 ChatGPT 账户登录，为 Codex 兼容插件提供认证状态。",
			expand: "展开设置",
			collapse: "折叠设置",
			loading: "正在加载账户信息…",
			signedOut: "尚未登录",
			signingIn: "正在等待 Codex 授权…",
			signedIn: "已登录",
			signIn: "去登录",
			signOut: "退出登录",
			working: "处理中…",
			popupBlocked: "浏览器阻止了登录窗口。请允许此 dsh 页面弹出窗口后重试。",
			requestFailed: "Codex 账户请求失败。",
			remoteOrigin: "当前浏览器来源未被 DSH Web 服务信任。",
			authorizationCodeHelp: "插件已生成一次性授权码。请在打开的 Codex 授权页面中输入此代码，无需选择工作空间。",
			authorizationCodeLabel: "Codex 授权码",
			openAuthorization: "打开授权页面",
			usageTitle: "通用使用限额",
			refreshUsage: "刷新",
			usageLoading: "正在加载用量…",
			usageUnavailable: "暂时无法获取 Codex 用量信息。",
			usagePlan: "套餐",
			usageAvailable: "可用",
			usageLimitReached: "已达到限制",
			usageUnlimited: "额度不限量",
			usageBalance: "额度余额",
			usagePrimary: "主要窗口",
			usageSecondary: "用量窗口",
			usageWeekly: "每周使用限额",
			usageRemaining: "剩余",
			usageResetAt: "重置时间：",
			usageResetAfter: "还剩",
			usageMinutes: " 分钟",
			usageNoWindow: "暂无每周用量信息。",
			capabilitiesTitle: "图片能力",
			capabilitiesIntro: "配置 Codex 模型路由的可选图片能力。",
			enableImageRecognition: "启用图片识别",
			enableImageRecognitionHelp: "增加 view_image 工具，让具备图片输入能力的 Codex 模型读取经过授权的本地图片。",
			enableImageUpload: "启用图片上传",
			enableImageUploadHelp: "允许具备图片输入能力的 Codex 模型接收粘贴或拖入对话的图片。",
			enableImageGeneration: "启用图像生成",
			imageGenerationUnavailableHelp: "当前 Codex 提供方和 DSH rc.7 模型适配器暂不支持图像输出。",
			settingsLoading: "正在加载插件设置…",
			settingsUnavailable: "此 dsh profile 无法使用插件设置。",
			settingsReadOnly: "此 profile 的插件设置为只读。",
			settingsSaved: "已保存",
			settingsSaveFailed: "设置保存失败。",
			discard: "放弃",
			save: "保存",
			saving: "保存中…"
		};
		//#endregion
		//#region src/client/index.tsx
		const name = "dsh-codex-auth-plugin-client";
		const inject = [
			"slots",
			"locale",
			"connection",
			"remote",
			"settingsScope"
		];
		function apply(ctx) {
			ctx.effect(() => installCodexModelEditorPresentation(), "dsh-codex-auth-plugin: Codex model editor presentation");
			const namespace = "settings.dsh-codex-auth";
			ctx.effect(() => ctx.locale.register(namespace, {
				zh,
				en
			}), "dsh-codex-auth-plugin: locale");
			const t = ctx.locale.bind(namespace);
			const remoteScope = ctx.get("connection").isLoopback ? void 0 : new CodexAuthRemoteSettingsScope();
			const configScope = remoteScope ?? ctx.settingsScope.bind({
				namespace: "dsh-codex-auth",
				decode: decodeCodexAuthSettings
			});
			if (remoteScope !== void 0) ctx.effect(() => {
				remoteScope.load();
				return async () => {
					await remoteScope.dispose();
				};
			}, "dsh-codex-auth-plugin: remote settings scope");
			ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
				name: "settings.plugin.item",
				key: CODEX_AUTH_SETTINGS_NAMESPACE,
				inject: () => ({
					t,
					configScope
				})
			}, CodexAuthCard));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
