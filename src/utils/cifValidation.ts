/**
 * Utilidades de validación y formateo para CIF y NIF en España:
 *
 * Requisito:
 * "Cuando se crea una empresa es obligatorio que el CIF contenga la letra y los 8 números
 * al igual que si introduces el NIF."
 *
 * - CIF (sociedades, etc.): 1 letra inicial y 8 números (o 7 dígitos + carácter alfanumérico de control), ej: B12345678, A12345678, B1234567A.
 * - NIF (persona física / autónomos): 8 números y 1 letra final, ej: 12345678Z.
 * - NIE (extranjeros residentes): 1 letra inicial (X, Y, Z) + 7 números + 1 letra final, ej: X1234567L.
 *
 * Total de caracteres: exactamente 9.
 */
export interface CifValidationResult {
  valid: boolean;
  error?: string;
  formatted: string;
}

export const validateCifOrNif = (value: string): CifValidationResult => {
  const cleaned = (value || '').trim().toUpperCase().replace(/[\s-]/g, '');

  if (!cleaned) {
    return {
      valid: false,
      error: 'El CIF/NIF de la empresa es obligatorio.',
      formatted: '',
    };
  }

  if (cleaned.length !== 9) {
    return {
      valid: false,
      error: `El CIF/NIF debe tener exactamente 9 caracteres (has introducido ${cleaned.length}). Debe contener la letra y 8 números para CIF, u 8 números y la letra para NIF.`,
      formatted: cleaned,
    };
  }

  // CIF: 1 letra inicial + 8 dígitos (o 7 dígitos + 1 carácter de control)
  // Ejemplos válidos: B12345678, A12345678, B1234567A
  const cifStandardRegex = /^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$/i;
  const cifLetter8DigitsRegex = /^[A-Z][0-9]{8}$/i;

  // NIF: 8 números + 1 letra al final
  // Ejemplo válido: 12345678Z
  const nifRegex = /^[0-9]{8}[A-Z]$/i;

  // NIE: X, Y o Z + 7 números + 1 letra al final
  // Ejemplo válido: X1234567Z
  const nieRegex = /^[XYZ][0-9]{7}[A-Z]$/i;

  if (
    cifStandardRegex.test(cleaned) ||
    cifLetter8DigitsRegex.test(cleaned) ||
    nifRegex.test(cleaned) ||
    nieRegex.test(cleaned)
  ) {
    return {
      valid: true,
      formatted: cleaned,
    };
  }

  return {
    valid: false,
    error: 'Formato incorrecto. El CIF debe contener la letra inicial y los 8 números (ej. B12345678) o bien 8 números y la letra en caso de NIF (ej. 12345678Z).',
    formatted: cleaned,
  };
};

/**
 * Validación de DNI / NIE para clave de acceso de usuarios (operarios, administrativos, solo lectura):
 * - DNI: 8 números y 1 letra final (ej. 12345678Z)
 * - NIE: X, Y o Z + 7 números y 1 letra final (ej. X1234567L)
 */
export const validateDniOrNie = (value: string): CifValidationResult => {
  const cleaned = (value || '').trim().toUpperCase().replace(/[\s-]/g, '');

  if (!cleaned) {
    return {
      valid: false,
      error: 'El DNI/NIE del usuario es obligatorio.',
      formatted: '',
    };
  }

  if (cleaned.length !== 9) {
    return {
      valid: false,
      error: `El DNI/NIE debe tener 9 caracteres (8 números y la letra, has introducido ${cleaned.length}).`,
      formatted: cleaned,
    };
  }

  const dniRegex = /^[0-9]{8}[A-Z]$/;
  const nieRegex = /^[XYZ][0-9]{7}[A-Z]$/;

  if (dniRegex.test(cleaned) || nieRegex.test(cleaned)) {
    return {
      valid: true,
      formatted: cleaned,
    };
  }

  return {
    valid: false,
    error:
      'Formato de DNI/NIE incorrecto. Debes introducir los 8 números y la letra (ej. 12345678Z) o formato NIE (ej. X1234567L).',
    formatted: cleaned,
  };
};
