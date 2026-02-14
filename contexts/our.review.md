# Code Review Guide

## 1. Review Rules

Follow everything in `./our.code.conventions.md` file.

AND

- Minimize comments
  - Remove any comments that just repeat the function name
  - Do not add comments if the code is already self-explanatory
- Remove unnecessary whitespace
- Remove unused imports (variables/functions)


## 2. Review Process

You are a senior developer and responsible for the peer review and you should maintain code quality according to the Guidelines in `./our.code.conventions.md` file.
Strictly follow the following steps and the review plan and checklist document.
use `docs/review/<MR_ID>` directory for the documents.

### Step 1: Review the Code

#### 1.1 Get the Diff from the MR

```bash
# Get MR changes and split into multiple files
bash ../scripts/get_diff.sh <MR_ID> 500
```

Advise to install when jq or curl was not installed or available.
This will create multiple files:
  - `docs/review/<MR_ID>/diff.md` - Complete diff file
  - `docs/review/<MR_ID>/diff.index.md` - Index of split files
  - `docs/review/<MR_ID>/diff.1.md`, `docs/review/<MR_ID>/diff.2.md`, ... - Split files (500 lines each)



#### 1.2 Create Review Plan Document

Create the review plan document in a new markdown file, `./docs/review/<MR_ID>/plan.md`
- Strictly follow the template file, `./docs/review/sample.review.md`
- Summarize changes
- List the modified/added files in the `Modified Files` section (exclude lock files)
- Add a "Review Progress" section to track which diff files have been reviewed:
  ```markdown
  ## Review Progress
  - [ ] diff.1.md
  - [ ] diff.2.md
  - [ ] diff.3.md
  ...
  ```
- Leave the "Recommendations" section empty for now

#### 1.3 Review Diff Files Incrementally

**IMPORTANT**: Review ONE diff file at a time. Do NOT read all diff files at once.

Read the diff index file `./docs/review/<MR_ID>/diff.index.md` to see how many diff files exist.

For each diff file, follow this cycle:

1. **Read ONE diff file**: `diff.<number>.md`
   - Each file contains 500 lines
   - Read from line 1 to 500 at once
   - **Important**: Do NOT ignore `-` and `+` signs in diff
   - Focus on the `+` lines which are added on the MR

2. **Append recommendations to plan.md** for bad practices found in THIS diff file only
   - Use `[ ]` checkbox format
   - Describe the recommendation shortly based on `aidlc/contexts/our.code.conventions.md` file:
     - Short description
     - Followed by filename(s) in `-` bullet point subitem per file
     - Do more investigation against the codebase if required (same commit as MR)
     - If uncertain about intention, note this and ask for clarification
     - Be specific about actual issues, not speculation
     - Strictly follow the guideline over best practices
   - Focus on preventing bad practices
   - NO (structural) refactoring allowed

3. **Update Review Progress**: Mark the diff file as reviewed in plan.md
   ```markdown
   - [x] diff.<number>.md
   ```

4. **Move to next diff file**: Repeat steps 1-3 for `diff.<number+1>.md`

5. **Continue until all diff files are reviewed**

**Important Notes**
- Do not expand scope beyond MR changes
- Focus on preventing bad practices from spreading, not refactoring
- Read all 500 lines thoroughly in each diff file
- Be specific about filenames and line numbers
- If all changes follow the guideline, mention "there is no recommendation for this MR" and stop

#### 1.4 Line Handling Guidelines

**Focus on Added Lines**

When reviewing an MR, primarily focus on the added lines (lines starting with `+` in the diff).
These represent new code being introduced and should be your main concern.

**Handling Removed Lines**
- **Positive removals**: When bad practices are being removed (lines starting with `-`), this should be
  acknowledged positively, not listed as a "bad practice found" in the review.
- **Concerning removals**: Only comment on removed code if it creates issues like removing
  necessary validation, tests, or error handling.

  Examples:

  1. ✅ **Good change**:
    - Removing redundant error handling when there's already an outer try/catch block.
    These should be noted as a positive change, not a bad practice.
  2. ❌ **Bad practice (added)**:
    - Adding new code with anti-patterns like
      - missing error handling,
      - poor variable naming,
      - or unnecessary complexity.
    These should be listed as "bad practices found".
  3. ❌ **Concerning removal**:
    - Removing essential validation or error handling without replacement.
    These should be noted as "concerning changes".


### Step 2: Confirm Recommendations

- To get the confirmation on review plan, show some diff summary for each recommendation
  - review each recommendation as per the guideline focusing with the `+` sign in the diff view. fix the recommendation if you have found any mistakes. remove the recommendation if it was not relavant any more.
  - do more investigation against the codebase if required -- make sure it's on the same commit with the MR
  - do NOT make any assumption for the recommendations. always search the codebase so that the recommendation makes senses
- after fixing those, please explain again with some short diff
- Do not proceed to the next step before you can read ./docs/review/<MR_ID>/plan.md file is ticked for the confirmation as like `[x] this plan is confirmed by <person>`

### Step 3: Implement Fixes

Now, You are the developer who opened this MR. According to the review plan, you will fix the bad practices and implement the changes. make sure if the `plan.md` file has the confirmation like `[x] this plan is confirmed by <person>`

  - Make sure there are no unstaged changes and advise to stash if they exist
  - **IMPORTANT** Re-read the plan.md file to make sure to follow any updated plans.
  - Follow review plan strictly
  - **IMPORTANT** Tick the checklist in the `./docs/review/<MR_ID>/plan.md` along with the implementation progress:
    - `[_]` as in-progress: when you start the task
    - `[x]` as complete: as soon as you complete the task
  - Use `git diff` if progress tracking is needed
  - Implement the fixes until all tasks are completed, stop and ask when you failed to update the progress in the plan doc
