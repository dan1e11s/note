export interface PasswordPromptOptions {
  title: string;
  message?: string;
  confirm?: boolean;
  submitLabel?: string;
}

export function askPassword(options: PasswordPromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    const form = document.createElement("form");
    form.className = "modal-card";

    const heading = document.createElement("h2");
    heading.className = "modal-title";
    heading.textContent = options.title;
    form.append(heading);

    if (options.message !== undefined) {
      const message = document.createElement("p");
      message.className = "modal-message";
      message.textContent = options.message;
      form.append(message);
    }

    const password = document.createElement("input");
    password.type = "password";
    password.className = "field";
    password.placeholder = "Пароль";
    password.autocomplete = "new-password";
    form.append(password);

    let repeat: HTMLInputElement | null = null;
    if (options.confirm === true) {
      repeat = document.createElement("input");
      repeat.type = "password";
      repeat.className = "field";
      repeat.placeholder = "Повтор пароля";
      repeat.autocomplete = "new-password";
      form.append(repeat);
    }

    const error = document.createElement("span");
    error.className = "modal-error";
    form.append(error);

    const buttons = document.createElement("div");
    buttons.className = "modal-buttons";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "action";
    cancel.textContent = "Отмена";

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "action action-primary";
    submit.textContent = options.submitLabel ?? "Готово";

    buttons.append(cancel, submit);
    form.append(buttons);
    overlay.append(form);

    const close = (value: string | null): void => {
      overlay.remove();
      document.removeEventListener("keydown", onKeyDown);
      resolve(value);
    };

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(null);
      }
    };

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = password.value;
      if (value.length === 0) {
        error.textContent = "Введите пароль";
        return;
      }
      if (repeat !== null && repeat.value !== value) {
        error.textContent = "Пароли не совпадают";
        return;
      }
      close(value);
    });

    cancel.addEventListener("click", () => {
      close(null);
    });

    overlay.addEventListener("pointerdown", (event) => {
      if (event.target === overlay) {
        close(null);
      }
    });

    document.addEventListener("keydown", onKeyDown);
    document.body.append(overlay);
    password.focus();
  });
}
