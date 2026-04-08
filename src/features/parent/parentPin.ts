export const PARENT_PIN_LENGTH = 4;

export function normalizeParentPin(value: string) {
  return value.replace(/\D+/g, '').slice(0, PARENT_PIN_LENGTH);
}

export function validateParentPin(value: string) {
  if (value.length !== PARENT_PIN_LENGTH) {
    return `Enter a ${PARENT_PIN_LENGTH}-digit PIN.`;
  }

  return null;
}
