```markdown
# grocery-sync Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches you the core development patterns and conventions used in the `grocery-sync` TypeScript project. You'll learn how to structure files, write imports/exports, follow commit conventions, and understand the project's approach to testing. This guide will help you contribute code that is consistent with the existing codebase.

## Coding Conventions

### File Naming
- Use **PascalCase** for all file names.
  - Example: `GroceryList.ts`, `UserStore.ts`

### Import Style
- Use **alias imports** to reference modules.
  - Example:
    ```typescript
    import { GroceryItem } from '@models/GroceryItem';
    ```

### Export Style
- Use **named exports** for all modules.
  - Example:
    ```typescript
    export const addItem = (item: GroceryItem) => { ... };
    export function removeItem(id: string) { ... }
    ```

### Commit Messages
- Follow the **conventional commit** format.
- Use the `feat` prefix for new features.
  - Example: `feat: add support for multiple grocery lists`
- Keep commit messages concise (average 75 characters).

## Workflows

### Adding a New Feature
**Trigger:** When implementing a new feature.
**Command:** `/add-feature`

1. Create a new file using PascalCase (e.g., `NewFeature.ts`).
2. Write your code using named exports.
3. Import dependencies using alias imports.
4. Write or update corresponding tests in a `*.test.*` file.
5. Commit your changes using the conventional commit format:
   ```
   feat: [short description of the feature]
   ```
6. Open a pull request for review.

### Writing Tests
**Trigger:** When adding or updating functionality.
**Command:** `/write-test`

1. Create or update a test file matching the pattern `*.test.*` (e.g., `GroceryList.test.ts`).
2. Write tests for your feature or bugfix.
3. Run the tests using the project's test runner (framework unknown; check project scripts).
4. Ensure all tests pass before committing.

## Testing Patterns

- Test files follow the `*.test.*` naming convention (e.g., `GroceryList.test.ts`).
- The specific testing framework is not detected; check for a test script or dependencies.
- Place tests alongside or near the code they test.

**Example:**
```typescript
// GroceryList.test.ts
import { addItem } from '@models/GroceryList';

describe('addItem', () => {
  it('adds an item to the list', () => {
    // test logic here
  });
});
```

## Commands
| Command       | Purpose                                    |
|---------------|--------------------------------------------|
| /add-feature  | Start the workflow for adding a new feature|
| /write-test   | Start the workflow for writing tests       |
```
