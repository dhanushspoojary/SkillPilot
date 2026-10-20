/**
 * SkillPilot Practice Arena Library
 * Problem library, test case verification, hint ladder, and cohort ranking.
 */

export type ProblemDifficulty = 'easy' | 'medium' | 'hard';
export type ProgrammingLanguage = 'python' | 'javascript' | 'c' | 'cpp' | 'java' | 'sql';

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
  explanation?: string;
}

export interface PracticeProblem {
  id: string;
  slug: string;
  title: string;
  difficulty: ProblemDifficulty;
  track: string;
  languages: ProgrammingLanguage[];
  tags: string[];
  estimatedMinutes: number;
  statement: string;
  examples: Array<{
    input: string;
    output: string;
    explanation?: string;
  }>;
  constraints: string[];
  starterCode: Partial<Record<ProgrammingLanguage, string>>;
  testCases: TestCase[];
  hintLadder: [
    string, // Level 1: Nudge question
    string, // Level 2: Underlying algorithmic concept
    string, // Level 3: Pseudo-code outline
    string, // Level 4: Code debugging guidance
    string  // Level 5: Worked solution
  ];
  timeComplexity: string;
  spaceComplexity: string;
}

export const PRACTICE_PROBLEMS: PracticeProblem[] = [
  {
    id: 'prob-two-sum-target',
    slug: 'two-sum-target',
    title: 'Pair with Target Sum',
    difficulty: 'easy',
    track: 'problem-solving',
    languages: ['python', 'javascript', 'c'],
    tags: ['Arrays', 'Hash Map', 'Pointers'],
    estimatedMinutes: 15,
    statement:
      'Given an array of integers `nums` and an integer `target`, return the indices of the two numbers such that they add up to `target`. You may assume that each input would have exactly one solution, and you may not use the same element twice.',
    examples: [
      {
        input: 'nums = [2, 7, 11, 15], target = 9',
        output: '[0, 1]',
        explanation: 'Because nums[0] + nums[1] == 2 + 7 == 9, we return [0, 1].',
      },
      {
        input: 'nums = [3, 2, 4], target = 6',
        output: '[1, 2]',
        explanation: 'Because nums[1] + nums[2] == 2 + 4 == 6, we return [1, 2].',
      },
    ],
    constraints: [
      '2 <= nums.length <= 10^4',
      '-10^9 <= nums[i] <= 10^9',
      '-10^9 <= target <= 10^9',
      'Only one valid answer exists.',
    ],
    starterCode: {
      python: 'def two_sum(nums: list[int], target: int) -> list[int]:\n    # Write your solution here\n    pass\n',
      javascript: 'function twoSum(nums, target) {\n  // Write your solution here\n  \n}\n',
      c: '#include <stdio.h>\n\nvoid twoSum(int* nums, int numsSize, int target, int* returnIndices) {\n    // Write your solution here\n}\n',
      cpp: '#include <vector>\n\nstd::vector<int> twoSum(std::vector<int>& nums, int target) {\n    // Write your solution here\n    return {};\n}\n',
      java: 'class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Write your solution here\n        return new int[]{};\n    }\n}\n',
    },
    testCases: [
      {
        id: 'tc-1',
        input: '[2, 7, 11, 15], 9',
        expectedOutput: '[0, 1]',
        isHidden: false,
      },
      {
        id: 'tc-2',
        input: '[3, 2, 4], 6',
        expectedOutput: '[1, 2]',
        isHidden: false,
      },
      {
        id: 'tc-3',
        input: '[3, 3], 6',
        expectedOutput: '[0, 1]',
        isHidden: true,
      },
      {
        id: 'tc-4',
        input: '[-1, -2, -3, -4, -5], -8',
        expectedOutput: '[2, 4]',
        isHidden: true,
      },
    ],
    hintLadder: [
      'What number do you need to add to the current number to reach target? That is your complement (target - nums[i]).',
      'Instead of scanning the whole array for every element (O(n²)), consider storing numbers you have already visited in a hash map or lookup table to check in O(1) time.',
      'Initialize map seen = {}.\nFor i from 0 to len(nums)-1:\n  needed = target - nums[i]\n  if needed in seen: return [seen[needed], i]\n  seen[nums[i]] = i',
      'Check your indices: make sure you return the indices, not the array values themselves. Also ensure you do not use the same index twice.',
      'Worked Solution:\nfunction twoSum(nums, target) {\n  const seen = new Map();\n  for (let i = 0; i < nums.length; i++) {\n    const needed = target - nums[i];\n    if (seen.has(needed)) {\n      return [seen.get(needed), i];\n    }\n    seen.set(nums[i], i);\n  }\n  return [];\n}',
    ],
    timeComplexity: 'O(n) with hash map, O(n²) brute force',
    spaceComplexity: 'O(n) auxiliary memory for visited items',
  },
  {
    id: 'prob-reverse-linked-list',
    slug: 'reverse-linked-list',
    title: 'Reverse a Singly Linked List',
    difficulty: 'easy',
    track: 'c-systems',
    languages: ['c', 'python', 'javascript'],
    tags: ['Linked List', 'Pointers', 'Memory'],
    estimatedMinutes: 20,
    statement:
      'Given the head of a singly linked list, reverse the list by updating its next pointers, and return the reversed list head.',
    examples: [
      {
        input: 'head = [1, 2, 3, 4, 5]',
        output: '[5, 4, 3, 2, 1]',
      },
      {
        input: 'head = [1, 2]',
        output: '[2, 1]',
      },
    ],
    constraints: [
      'The number of nodes in the list is the range [0, 5000].',
      '-5000 <= Node.val <= 5000',
    ],
    starterCode: {
      c: 'struct ListNode {\n    int val;\n    struct ListNode *next;\n};\n\nstruct ListNode* reverseList(struct ListNode* head) {\n    // Initialize prev, curr, next pointers\n    \n}\n',
      python: 'class ListNode:\n    def __init__(self, val=0, next=None):\n        self.val = val\n        self.next = next\n\ndef reverse_list(head: ListNode | None) -> ListNode | None:\n    # Write your solution here\n    pass\n',
      javascript: 'function reverseList(head) {\n  // Write your solution here\n  \n}\n',
      cpp: 'struct ListNode { int val; ListNode* next; };\nListNode* reverseList(ListNode* head) {\n    // Write your solution here\n    return nullptr;\n}\n',
      java: 'class Solution {\n    public ListNode reverseList(ListNode head) {\n        // Write your solution here\n        return null;\n    }\n}\n',
    },
    testCases: [
      {
        id: 'tc-1',
        input: '[1, 2, 3, 4, 5]',
        expectedOutput: '[5, 4, 3, 2, 1]',
        isHidden: false,
      },
      {
        id: 'tc-2',
        input: '[]',
        expectedOutput: '[]',
        isHidden: false,
      },
      {
        id: 'tc-3',
        input: '[1]',
        expectedOutput: '[1]',
        isHidden: true,
      },
    ],
    hintLadder: [
      'Before you change node->next to point backwards, where do you store the pointer to the rest of the original list so it does not get lost?',
      'You need three pointers: `prev` (starts NULL), `curr` (starts at head), and `next` (temporary holder).',
      'While curr != NULL:\n  next = curr.next\n  curr.next = prev\n  prev = curr\n  curr = next\nReturn prev',
      'A common pitfall is returning `curr` instead of `prev`. When the loop finishes, `curr` is NULL and `prev` points to the new head.',
      'Worked Solution:\nstruct ListNode* reverseList(struct ListNode* head) {\n    struct ListNode *prev = NULL;\n    struct ListNode *curr = head;\n    while (curr != NULL) {\n        struct ListNode *next = curr->next;\n        curr->next = prev;\n        prev = curr;\n        curr = next;\n    }\n    return prev;\n}',
    ],
    timeComplexity: 'O(n) where n is number of nodes',
    spaceComplexity: 'O(1) in-place pointer manipulation',
  },
  {
    id: 'prob-valid-parentheses',
    slug: 'valid-parentheses',
    title: 'Balanced Bracket Validator',
    difficulty: 'easy',
    track: 'problem-solving',
    languages: ['javascript', 'python', 'c'],
    tags: ['Stack', 'Strings'],
    estimatedMinutes: 15,
    statement:
      'Given a string `s` containing just the characters `(`, `)`, `{`, `}`, `[` and `]`, determine if the input string is valid. An input string is valid if open brackets are closed by the same type of brackets and in the correct order.',
    examples: [
      {
        input: 's = "()"',
        output: 'true',
      },
      {
        input: 's = "()[]{}"',
        output: 'true',
      },
      {
        input: 's = "(]"',
        output: 'false',
      },
    ],
    constraints: [
      '1 <= s.length <= 10^4',
      's consists of parentheses only `()[]{}`.',
    ],
    starterCode: {
      javascript: 'function isValid(s) {\n  // Write your solution here\n  \n}\n',
      python: 'def is_valid(s: str) -> bool:\n    # Write your solution here\n    pass\n',
      c: '#include <stdbool.h>\n\nbool isValid(char* s) {\n    // Write your solution here\n}\n',
      cpp: '#include <string>\nbool isValid(std::string s) {\n    // Write your solution here\n    return false;\n}\n',
      java: 'class Solution {\n    public boolean isValid(String s) {\n        // Write your solution here\n        return false;\n    }\n}\n',
    },
    testCases: [
      {
        id: 'tc-1',
        input: '"()"',
        expectedOutput: 'true',
        isHidden: false,
      },
      {
        id: 'tc-2',
        input: '"([)]"',
        expectedOutput: 'false',
        isHidden: false,
      },
      {
        id: 'tc-3',
        input: '"{[]}"',
        expectedOutput: 'true',
        isHidden: false,
      },
      {
        id: 'tc-4',
        input: '"]"',
        expectedOutput: 'false',
        isHidden: true,
      },
    ],
    hintLadder: [
      'When you see an opening bracket, what data structure lets you match the most recently opened bracket first (Last In, First Out)?',
      'Use a Stack. Push opening brackets `(`, `[`, `{`. When you encounter a closing bracket, pop from the stack and verify that it matches.',
      'stack = []\nmapping = { ")": "(", "}": "{", "]": "[" }\nfor char in s:\n  if char in mapping:\n    top = stack.pop() if stack else "#"\n    if mapping[char] != top: return False\n  else:\n    stack.append(char)\nreturn len(stack) == 0',
      'Remember edge cases: what if the string starts with a closing bracket like `]`? Or what if there are leftover opening brackets like `(` at the end?',
      'Worked Solution:\nfunction isValid(s) {\n  const stack = [];\n  const pairs = { ")": "(", "}": "{", "]": "[" };\n  for (const ch of s) {\n    if (pairs[ch]) {\n      if (stack.pop() !== pairs[ch]) return false;\n    } else {\n      stack.push(ch);\n    }\n  }\n  return stack.length === 0;\n}',
    ],
    timeComplexity: 'O(n) where n is length of string',
    spaceComplexity: 'O(n) stack memory in worst case',
  },
  {
    id: 'prob-maximum-subarray',
    slug: 'maximum-subarray',
    title: 'Maximum Contiguous Subarray (Kadane)',
    difficulty: 'medium',
    track: 'problem-solving',
    languages: ['python', 'javascript', 'c'],
    tags: ['Dynamic Programming', 'Arrays'],
    estimatedMinutes: 20,
    statement:
      'Given an integer array `nums`, find the subarray with the largest sum, and return its sum.',
    examples: [
      {
        input: 'nums = [-2, 1, -3, 4, -1, 2, 1, -5, 4]',
        output: '6',
        explanation: 'The subarray [4, -1, 2, 1] has the largest sum 6.',
      },
      {
        input: 'nums = [1]',
        output: '1',
      },
      {
        input: 'nums = [5, 4, -1, 7, 8]',
        output: '23',
      },
    ],
    constraints: [
      '1 <= nums.length <= 10^5',
      '-10^4 <= nums[i] <= 10^4',
    ],
    starterCode: {
      python: 'def max_sub_array(nums: list[int]) -> int:\n    # Write your solution here\n    pass\n',
      javascript: 'function maxSubArray(nums) {\n  // Write your solution here\n  \n}\n',
      c: 'int maxSubArray(int* nums, int numsSize) {\n    // Write your solution here\n}\n',
      cpp: '#include <vector>\nint maxSubArray(std::vector<int>& nums) {\n    return 0;\n}\n',
      java: 'class Solution {\n    public int maxSubArray(int[] nums) {\n        return 0;\n    }\n}\n',
    },
    testCases: [
      {
        id: 'tc-1',
        input: '[-2, 1, -3, 4, -1, 2, 1, -5, 4]',
        expectedOutput: '6',
        isHidden: false,
      },
      {
        id: 'tc-2',
        input: '[1]',
        expectedOutput: '1',
        isHidden: false,
      },
      {
        id: 'tc-3',
        input: '[-1]',
        expectedOutput: '-1',
        isHidden: true,
      },
      {
        id: 'tc-4',
        input: '[-2, -1]',
        expectedOutput: '-1',
        isHidden: true,
      },
    ],
    hintLadder: [
      'At each index `i`, ask: Is it better to add `nums[i]` to our current ongoing subarray sum, or start fresh from `nums[i]`?',
      'This is Kadane\'s algorithm. Keep track of `current_max` and `global_max`. At each number, `current_max = max(num, current_max + num)`.',
      'max_so_far = nums[0]\ncurrent_max = nums[0]\nfor i from 1 to len(nums)-1:\n  current_max = max(nums[i], current_max + nums[i])\n  max_so_far = max(max_so_far, current_max)\nreturn max_so_far',
      'Careful with all-negative arrays! If all numbers are negative (e.g. `[-3, -1, -5]`), your max sum must be `-1`, not `0`.',
      'Worked Solution:\nfunction maxSubArray(nums) {\n  let cur = nums[0];\n  let max = nums[0];\n  for (let i = 1; i < nums.length; i++) {\n    cur = Math.max(nums[i], cur + nums[i]);\n    max = Math.max(max, cur);\n  }\n  return max;\n}',
    ],
    timeComplexity: 'O(n) linear single pass',
    spaceComplexity: 'O(1) constant extra variables',
  },
  {
    id: 'prob-sql-second-highest',
    slug: 'sql-second-highest-salary',
    title: 'Second Highest Salary Query',
    difficulty: 'medium',
    track: 'sql-databases',
    languages: ['sql', 'javascript'], // Query represented in SQL
    tags: ['SQL', 'Aggregates', 'Subquery'],
    estimatedMinutes: 15,
    statement:
      'Write an SQL query to find the second highest distinct salary from the `Employee` table. If there is no second highest salary, the query should report `null`.',
    examples: [
      {
        input: 'Employee table:\n+----+--------+\n| id | salary |\n+----+--------+\n| 1  | 100    |\n| 2  | 200    |\n| 3  | 300    |\n+----+--------+',
        output: '+---------------------+\n| SecondHighestSalary |\n+---------------------+\n| 200                 |\n+---------------------+',
      },
    ],
    constraints: [
      'Salary values are positive integers.',
      'Handle duplicate highest salaries gracefully.',
    ],
    starterCode: {
      sql: 'SELECT MAX(salary) AS SecondHighestSalary\nFROM Employee\nWHERE salary < (SELECT MAX(salary) FROM Employee);\n',
      javascript: '-- Write your SQL query below\nSELECT DISTINCT salary AS SecondHighestSalary\nFROM Employee\n',
      python: '# SQL Query\nQUERY = """SELECT DISTINCT salary AS SecondHighestSalary FROM Employee"""\n',
      c: '/* SQL Query representation */\n',
      cpp: '/* SQL Query representation */\n',
      java: '/* SQL Query representation */\n',
    },
    testCases: [
      {
        id: 'tc-1',
        input: '[[1, 100], [2, 200], [3, 300]]',
        expectedOutput: '200',
        isHidden: false,
      },
      {
        id: 'tc-2',
        input: '[[1, 100]]',
        expectedOutput: 'null',
        isHidden: false,
      },
    ],
    hintLadder: [
      'What happens if there are two employees tied with the highest salary ($300, $300)? You need DISTINCT salaries.',
      'You can find the maximum salary strictly less than the overall maximum salary using a subquery.',
      'SELECT MAX(salary) AS SecondHighestSalary\nFROM Employee\nWHERE salary < (SELECT MAX(salary) FROM Employee);',
      'Using LIMIT 1 OFFSET 1 works only if you wrap it in a subquery or IFNULL, because offset on an empty result set returns 0 rows instead of NULL.',
      'Worked Solution:\nSELECT MAX(salary) AS SecondHighestSalary\nFROM Employee\nWHERE salary < (SELECT MAX(salary) FROM Employee);',
    ],
    timeComplexity: 'O(n) index scan',
    spaceComplexity: 'O(1) scalar aggregate',
  },
];

export interface ExecutionResult {
  success: boolean;
  testCaseResults: Array<{
    testCaseId: string;
    passed: boolean;
    input: string;
    expected: string;
    actual: string;
    runtimeMs: number;
    error?: string;
    status?: string;
    compileOutput?: string;
  }>;
  totalPassed: number;
  totalTests: number;
  runtimeMs: number;
  memoryKb: number;
  runnerType: 'sandbox' | 'disabled_no_sandbox';
  isRunnerAvailable: boolean;
  status?: string;
  provider?: 'judge0' | 'piston' | 'onlinecompiler' | 'sqlite_internal' | 'none';
  message?: string;
}

