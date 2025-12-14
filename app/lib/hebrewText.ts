// Hebrew text constants - loaded at runtime to avoid Next.js static analysis issues
// Using function to ensure this is evaluated at runtime, not during static analysis
export function getHebrewTexts() {
  return {
    completionMessage: "הנה פרטי המוצר לבחירתך",
    errorMessage: "מצטער, אירעה שגיאה בעיבוד הבקשה. אנא נסה שוב.",
    fallbackMessage: "מצטער, לא הצלחתי לעבד את הבקשה.",
    aiErrorMessage: "לא הצלחתי לעבד את הבקשה.",
  };
}

// Export as lazy getter to prevent static analysis
export const HEBREW_TEXTS = getHebrewTexts();

