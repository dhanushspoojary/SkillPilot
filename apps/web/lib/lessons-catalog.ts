export interface LessonExercise {
  id: string;
  type: 'code_tracing' | 'debugging' | 'conceptual' | 'fill_in_the_blank';
  prompt: string;
  codeSnippet?: string;
  language?: string;
  choices: string[];
  correctIndex: number;
  hints: string[];
  explanation: string;
  misconceptions?: Record<number, string>;
  concept: string;
  difficulty: 'introductory' | 'foundational' | 'intermediate' | 'advanced';
}

export interface WalkthroughStep {
  step: number;
  title: string;
  codeSnippet: string;
  language?: string;
  highlightLines?: number[];
  explanation: string;
  mentalModelNote: string;
  traceTable?: {
    iteration: string;
    currentValue: string;
    condition: string;
    updatedValue: string;
  }[];
}

export interface LessonDefinition {
  id: string;
  skillSlug: string;
  language: string;
  title: string;
  subtitle: string;
  summary?: string;
  topic: string;
  difficulty: 'introductory' | 'foundational' | 'intermediate' | 'advanced';
  estimatedMinutes: string | number;
  whyItMatters: string;
  prerequisites: string[];
  concepts: string[];
  introduction: string;
  keyDefinitions: { term: string; definition: string; analogy?: string }[];
  codeWalkthrough: {
    language: string;
    code: string;
    annotations: { line: number; note: string }[];
  };
  walkthroughSteps?: WalkthroughStep[];
  commonPitfalls: {
    title?: string;
    explanation?: string;
    example?: string;
    misconception?: string;
    whyItFails?: string;
    correctApproach?: string;
  }[];
  exercises: LessonExercise[];
  nextLessonId?: string;
}

export const LESSONS_CATALOG: LessonDefinition[] = [
  // =========================================================================
  // 1. PROBLEM SOLVING / DSA: FOUNDATIONAL LOGIC & LOOP TRACING
  // =========================================================================
  {
    id: 'ps-loop-tracing',
    skillSlug: 'problem-solving',
    language: 'c',
    title: 'Loop Tracing & Algorithmic State',
    subtitle: 'Step-by-step mental execution of variables across iterations',
    topic: 'loop_tracing',
    difficulty: 'introductory',
    estimatedMinutes: '12 mins',
    whyItMatters: 'Before writing complex algorithms, an engineer must accurately simulate in their head how state changes over time. Tracing bugs account for 70% of beginner errors.',
    prerequisites: ['Basic arithmetic', 'Variable assignments'],
    concepts: ['loop_invariants', 'accumulator_pattern', 'off_by_one_boundaries'],
    introduction: 'A loop is simply an instruction that repeats while a condition remains true. In every iteration, variables evolve. The key to tracing is keeping a mental or written table of each variable’s value at the start and end of each pass.',
    keyDefinitions: [
      { term: 'Accumulator', definition: 'A variable initialized before a loop that gathers results (like a running sum or product) across iterations.' },
      { term: 'Iteration', definition: 'A single complete pass through the body of a repeating loop.' },
      { term: 'Loop Invariant', definition: 'A property of the program that remains true before and after each iteration.' }
    ],
    codeWalkthrough: {
      language: 'c',
      code: `int total = 0;\nfor (int i = 1; i <= 4; i++) {\n    if (i % 2 == 0) {\n        total += i * 2;\n    } else {\n        total += i;\n    }\n}`,
      annotations: [
        { line: 1, note: 'total initialized to 0.' },
        { line: 2, note: 'i runs through values 1, 2, 3, 4.' },
        { line: 3, note: 'Even numbers are multiplied by 2 before adding.' },
        { line: 5, note: 'Odd numbers are added directly: pass 1: +1 (1), pass 2: +4 (5), pass 3: +3 (8), pass 4: +8 (16).' }
      ]
    },
    walkthroughSteps: [
      {
        step: 1,
        title: 'Initializing the Accumulator',
        codeSnippet: `int total = 0;\nfor (int i = 1; i <= 4; i++) {\n    if (i % 2 == 0) {\n        total += i * 2;\n    } else {\n        total += i;\n    }\n}`,
        language: 'c',
        highlightLines: [1],
        explanation: 'We create an integer variable named `total` and set it to 0. This variable is an "accumulator" — a designated storage box that collects running totals as the loop runs.',
        mentalModelNote: 'Always initialize accumulators before the loop. In C, an uninitialized variable contains unpredictable garbage memory.',
        traceTable: [
          { iteration: 'Start', currentValue: 'uninitialized', condition: 'Before loop', updatedValue: 'total = 0' }
        ]
      },
      {
        step: 2,
        title: 'Loop Header & Range (i from 1 to 4)',
        codeSnippet: `int total = 0;\nfor (int i = 1; i <= 4; i++) {\n    if (i % 2 == 0) {\n        total += i * 2;\n    } else {\n        total += i;\n    }\n}`,
        language: 'c',
        highlightLines: [2],
        explanation: 'The loop counter `i` starts at 1. The condition `i <= 4` checks if `i` is at most 4. After each iteration, `i++` increments `i` by 1. The loop executes for i = 1, 2, 3, and 4.',
        mentalModelNote: 'Pay close attention to boundaries: `<= 4` includes 4, whereas `< 4` would stop early at 3.',
        traceTable: [
          { iteration: '1', currentValue: 'i = 1', condition: '1 <= 4 (True)', updatedValue: 'Enters loop body' }
        ]
      },
      {
        step: 3,
        title: 'First Iteration (i = 1, Odd Branch)',
        codeSnippet: `int total = 0;\nfor (int i = 1; i <= 4; i++) {\n    if (i % 2 == 0) {\n        total += i * 2;\n    } else {\n        total += i;\n    }\n}`,
        language: 'c',
        highlightLines: [5, 6],
        explanation: 'For i = 1, `1 % 2 == 0` evaluates to false (1 is odd). Control jumps to the else branch: `total += i`, so total = 0 + 1 = 1.',
        mentalModelNote: 'The modulo operator % calculates the remainder. When dividing by 2, remainder 0 means even, remainder 1 means odd.',
        traceTable: [
          { iteration: '1', currentValue: 'total = 0, i = 1', condition: '1 % 2 != 0 (Odd)', updatedValue: 'total = 1' }
        ]
      },
      {
        step: 4,
        title: 'Second Iteration (i = 2, Even Branch)',
        codeSnippet: `int total = 0;\nfor (int i = 1; i <= 4; i++) {\n    if (i % 2 == 0) {\n        total += i * 2;\n    } else {\n        total += i;\n    }\n}`,
        language: 'c',
        highlightLines: [3, 4],
        explanation: 'For i = 2, `2 % 2 == 0` is true (2 is even). The if branch runs: `total += 2 * 2`, adding 4. Total becomes 1 + 4 = 5.',
        mentalModelNote: 'Even passes double the value before adding it to the running accumulator.',
        traceTable: [
          { iteration: '1', currentValue: 'total = 0, i = 1', condition: 'Odd: +1', updatedValue: 'total = 1' },
          { iteration: '2', currentValue: 'total = 1, i = 2', condition: 'Even: +(2 * 2 = 4)', updatedValue: 'total = 5' }
        ]
      },
      {
        step: 5,
        title: 'Passes 3 & 4 and Termination',
        codeSnippet: `int total = 0;\nfor (int i = 1; i <= 4; i++) {\n    if (i % 2 == 0) {\n        total += i * 2;\n    } else {\n        total += i;\n    }\n}`,
        language: 'c',
        highlightLines: [2, 4, 6],
        explanation: 'Pass 3 (i = 3, odd): adds 3 -> total = 5 + 3 = 8. Pass 4 (i = 4, even): adds 4 * 2 = 8 -> total = 8 + 8 = 16. Finally i becomes 5; 5 <= 4 is false. Loop ends with total = 16.',
        mentalModelNote: 'Trace row-by-row on paper: never guess or try to calculate all loop iterations in your head at once.',
        traceTable: [
          { iteration: '1', currentValue: 'total = 0, i = 1', condition: 'Odd: +1', updatedValue: 'total = 1' },
          { iteration: '2', currentValue: 'total = 1, i = 2', condition: 'Even: +4', updatedValue: 'total = 5' },
          { iteration: '3', currentValue: 'total = 5, i = 3', condition: 'Odd: +3', updatedValue: 'total = 8' },
          { iteration: '4', currentValue: 'total = 8, i = 4', condition: 'Even: +8', updatedValue: 'total = 16' },
          { iteration: 'End', currentValue: 'total = 16, i = 5', condition: '5 <= 4 (False)', updatedValue: 'Terminated with total = 16' }
        ]
      }
    ],
    commonPitfalls: [
      {
        title: 'Off-By-One Boundary Error',
        explanation: 'Writing i < 4 instead of i <= 4 terminates the loop one iteration early, missing the final element.',
        example: 'i <= 4 runs for i=1,2,3,4. i < 4 stops at i=3.'
      },
      {
        title: 'Forgetting to Initialize the Accumulator',
        explanation: 'In C, an uninitialized variable contains garbage memory, which corrupts any addition operations.',
        example: 'int sum; // contains random garbage value! Always do: int sum = 0;'
      }
    ],
    exercises: [
      {
        id: 'ps-trace-q1',
        type: 'code_tracing',
        concept: 'accumulator_pattern',
        difficulty: 'introductory',
        language: 'c',
        prompt: 'Trace the following loop. What is the value of `count` after execution terminates?',
        codeSnippet: `int count = 0;\nfor (int i = 0; i < 5; i++) {\n    if (i % 2 != 0) {\n        count += i;\n    }\n}`,
        choices: ['4', '6', '9', '10'],
        correctIndex: 0,
        hints: [
          'List the values of i: 0, 1, 2, 3, 4.',
          'Identify which values are odd (i % 2 != 0): 1 and 3.',
          'Add them together: 1 + 3 = 4.'
        ],
        explanation: 'The loop executes for i = 0, 1, 2, 3, 4. The odd numbers are 1 and 3. Adding them to count yields 0 + 1 + 3 = 4.',
        misconceptions: {
          1: 'Did you include 2? 2 is even, so it is skipped.',
          3: 'Did you add all numbers 0 through 4? Only odd numbers satisfy i % 2 != 0.'
        }
      },
      {
        id: 'ps-trace-q2',
        type: 'debugging',
        concept: 'off_by_one_boundaries',
        difficulty: 'foundational',
        language: 'c',
        prompt: 'We want to calculate the sum of numbers from 1 to 5 inclusive (1 + 2 + 3 + 4 + 5 = 15). What is the bug in this code?',
        codeSnippet: `int sum = 0;\nfor (int i = 1; i < 5; i++) {\n    sum += i;\n}`,
        choices: [
          'The condition i < 5 stops at 4, omitting 5. It should be i <= 5.',
          'sum should be initialized to 1 instead of 0.',
          'i++ increments by 2 instead of 1.',
          'The loop never executes because 1 is less than 5.'
        ],
        correctIndex: 0,
        hints: [
          'Examine the loop condition: when does the loop stop?',
          'When i becomes 5, 5 < 5 is false, so 5 is never added.'
        ],
        explanation: 'The condition `i < 5` terminates when `i == 5`. To include 5 in the sum, the condition must be `i <= 5` or `i < 6`.',
        misconceptions: {
          1: 'Initializing sum to 1 would make the total 16 instead of 15.'
        }
      },
      {
        id: 'ps-trace-q3',
        type: 'conceptual',
        concept: 'loop_invariants',
        difficulty: 'foundational',
        language: 'c',
        prompt: 'Why is it dangerous to modify the loop counter `i` inside the body of a `for (int i = 0; i < N; i++)` loop?',
        choices: [
          'It makes the number of iterations unpredictable and can easily cause an infinite loop or skip critical data.',
          'It causes a compile-time syntax error in C.',
          'It automatically sets the variable to zero.',
          'It reduces the CPU clock speed.'
        ],
        correctIndex: 0,
        hints: [
          'Consider what happens if you decrement i inside the loop.',
          'Think about program predictability and termination conditions.'
        ],
        explanation: 'Modifying the loop index inside the body violates the loop invariant and makes control flow hard to reason about, frequently leading to infinite loops or missed iterations.',
        misconceptions: {
          1: 'C allows mutating i inside the loop; it compiles, but is an anti-pattern.'
        }
      }
    ]
  },

  // =========================================================================
  // 2. C PROGRAMMING: POINTERS & MEMORY ADDRESSES
  // =========================================================================
  {
    id: 'c-pointers-basics',
    skillSlug: 'c-systems',
    language: 'c',
    title: 'C Pointers & Memory Addressing',
    subtitle: 'Understanding the & (address-of) and * (dereference) operators',
    topic: 'pointers',
    difficulty: 'foundational',
    estimatedMinutes: '15 mins',
    whyItMatters: 'Pointers are the foundation of systems programming, memory management, and data structures like linked lists and trees. Mastering pointers separates novice coders from true systems engineers.',
    prerequisites: ['Variables in C', 'Data types (int, char)'],
    concepts: ['address_of_operator', 'dereference_operator', 'pointer_assignment'],
    introduction: 'Every variable in a computer program resides at a physical address in RAM. A pointer is simply a variable whose value is the memory address of another variable.',
    keyDefinitions: [
      { term: 'Address-of Operator (&)', definition: 'Returns the memory address where a variable is stored in RAM (e.g. &x).' },
      { term: 'Dereference Operator (*)', definition: 'Accesses the actual value stored at the memory address held by a pointer (e.g. *ptr).' },
      { term: 'NULL Pointer', definition: 'A pointer initialized to 0/NULL that explicitly points to no valid memory address.' }
    ],
    codeWalkthrough: {
      language: 'c',
      code: `int score = 42;\nint *ptr = &score; // ptr holds memory address of score\n*ptr = 99;         // modify the value at ptr's address\nprintf("%d", score); // prints 99!`,
      annotations: [
        { line: 1, note: 'score is allocated at an address, e.g., 0x7ffd00, holding value 42.' },
        { line: 2, note: 'ptr is created. Its value is 0x7ffd00 (the address of score).' },
        { line: 3, note: '*ptr dereferences: it goes to 0x7ffd00 and overwrites the contents with 99.' },
        { line: 4, note: 'score is now 99 because ptr modified its exact memory location.' }
      ]
    },
    walkthroughSteps: [
      {
        step: 1,
        title: 'Allocating a Variable in Memory',
        codeSnippet: `int score = 42;\nint *ptr = &score;\n*ptr = 99;\nprintf("%d", score);`,
        language: 'c',
        highlightLines: [1],
        explanation: 'The computer assigns a memory location (e.g., address 0x7ffd00 in RAM) to store the integer value 42 under the variable name `score`.',
        mentalModelNote: 'Every variable lives in a memory house. The variable name is the resident; the memory address is the house number.',
        traceTable: [
          { iteration: 'Alloc', currentValue: 'score', condition: 'int score = 42', updatedValue: 'Address: 0x7ffd00, Value: 42' }
        ]
      },
      {
        step: 2,
        title: 'Storing the Address in a Pointer',
        codeSnippet: `int score = 42;\nint *ptr = &score;\n*ptr = 99;\nprintf("%d", score);`,
        language: 'c',
        highlightLines: [2],
        explanation: 'The `&` (address-of) operator retrieves score’s address (0x7ffd00). The pointer `int *ptr` is created to hold this address.',
        mentalModelNote: 'A pointer does not store the number 42; it stores the address where 42 lives.',
        traceTable: [
          { iteration: '&score', currentValue: 'ptr', condition: 'int *ptr = &score', updatedValue: 'ptr = 0x7ffd00 (points to score)' }
        ]
      },
      {
        step: 3,
        title: 'Dereferencing with the * Operator',
        codeSnippet: `int score = 42;\nint *ptr = &score;\n*ptr = 99;\nprintf("%d", score);`,
        language: 'c',
        highlightLines: [3],
        explanation: 'The asterisk `*ptr` means "go to the address held by ptr and access the value there". Setting `*ptr = 99` overwrites the contents of address 0x7ffd00.',
        mentalModelNote: '*ptr is an alias for the memory location of score. Changing *ptr changes score directly.',
        traceTable: [
          { iteration: '*ptr = 99', currentValue: 'score was 42', condition: 'Dereference & write', updatedValue: 'score is now 99 at 0x7ffd00' }
        ]
      },
      {
        step: 4,
        title: 'Confirming the Modification',
        codeSnippet: `int score = 42;\nint *ptr = &score;\n*ptr = 99;\nprintf("%d", score);`,
        language: 'c',
        highlightLines: [4],
        explanation: 'When `printf("%d", score)` executes, it prints 99! Even though we did not write `score = 99`, the pointer updated the exact memory cell where `score` resides.',
        mentalModelNote: 'Pointers allow functions and remote code to directly update variables without copying them.',
        traceTable: [
          { iteration: 'Output', currentValue: 'score', condition: 'printf("%d", score)', updatedValue: 'Prints: 99' }
        ]
      }
    ],
    commonPitfalls: [
      {
        title: 'Dereferencing an Uninitialized Pointer',
        explanation: 'Doing `int *p; *p = 10;` without pointing p to a valid variable writes to a random memory address, causing a Segmentation Fault (crash).',
        example: 'Always point before dereferencing: int x; int *p = &x; *p = 10;'
      },
      {
        title: 'Confusing the Pointer with Its Target',
        explanation: '`p` is the address (e.g., 0x7fff...). `*p` is the value inside that address (e.g., 42). `&p` is the address of the pointer variable itself.',
        example: 'p = &x sets address. *p = 50 sets value.'
      }
    ],
    exercises: [
      {
        id: 'c-ptr-q1',
        type: 'code_tracing',
        concept: 'dereference_operator',
        difficulty: 'foundational',
        language: 'c',
        prompt: 'What will be printed when this C code runs?',
        codeSnippet: `int a = 10;\nint b = 20;\nint *p = &a;\n*p = 50;\np = &b;\n*p = 70;\nprintf("%d %d", a, b);`,
        choices: ['50 70', '10 20', '50 20', '70 70'],
        correctIndex: 0,
        hints: [
          'Trace what *p modifies when p points to a.',
          'Trace what *p modifies when p is reassigned to point to b.'
        ],
        explanation: 'First, p points to a, so `*p = 50` updates a to 50. Next, p points to b, so `*p = 70` updates b to 70. Both variables were modified through the pointer.',
        misconceptions: {
          2: 'Remember that p was redirected to &b before the second assignment, so b changed too.'
        }
      },
      {
        id: 'c-ptr-q2',
        type: 'debugging',
        concept: 'pointer_assignment',
        difficulty: 'foundational',
        language: 'c',
        prompt: 'Which line in the following code causes a dangerous undefined behavior / segmentation fault?',
        codeSnippet: `1: int main() {\n2:     int *ptr;\n3:     int val = 15;\n4:     *ptr = 20;\n5:     ptr = &val;\n6:     return 0;\n7: }`,
        choices: [
          'Line 4: *ptr = 20 is dereferencing an uninitialized wild pointer.',
          'Line 2: You cannot declare a pointer without assigning it immediately.',
          'Line 5: You cannot assign &val to an existing pointer.',
          'Line 3: val must be declared as a float.'
        ],
        correctIndex: 0,
        hints: [
          'What address does ptr hold at Line 4?',
          'ptr has not been assigned &val yet at Line 4.'
        ],
        explanation: 'At Line 4, `ptr` has not been assigned any valid address. Dereferencing an uninitialized pointer writes to an arbitrary memory address, causing a segmentation fault.',
        misconceptions: {
          1: 'Declaring `int *ptr;` is valid C syntax; the bug occurs when you dereference it before assigning an address.'
        }
      },
      {
        id: 'c-ptr-q3',
        type: 'fill_in_the_blank',
        concept: 'address_of_operator',
        difficulty: 'foundational',
        language: 'c',
        prompt: 'To pass a variable `int count` to a function `void increment(int *p)` so that the function can permanently modify `count`, what argument must be passed?',
        choices: [
          '&count (the memory address of count)',
          '*count (the dereferenced value)',
          'count (pass by value)',
          'sizeof(count)'
        ],
        correctIndex: 0,
        hints: [
          'The function expects an `int *` (a pointer to an integer).',
          'Which operator generates a pointer/address from a variable?'
        ],
        explanation: 'Passing `&count` provides the function with the memory address of count, allowing `increment` to modify the caller’s original variable via pass-by-reference.',
        misconceptions: {
          2: 'Passing count copies the integer value; changes inside the function would not affect the caller’s variable.'
        }
      }
    ]
  },

  // =========================================================================
  // 3. JAVASCRIPT: CLOSURES & LEXICAL SCOPING
  // =========================================================================
  {
    id: 'js-closures-scoping',
    skillSlug: 'javascript',
    language: 'javascript',
    title: 'JavaScript Closures & Lexical Scope',
    subtitle: 'How functions retain access to outer variables even after execution returns',
    topic: 'closures',
    difficulty: 'foundational',
    estimatedMinutes: '14 mins',
    whyItMatters: 'Closures power event handlers, data privacy (encapsulation), factory functions, and state management in modern JavaScript and React (e.g. useState hooks).',
    prerequisites: ['Functions in JS', 'let and const declarations'],
    concepts: ['lexical_scope', 'function_factories', 'state_encapsulation'],
    introduction: 'A closure is the combination of a function bundled together with references to its surrounding lexical environment. In JavaScript, every inner function has access to variables in its outer parent scope, even after the parent function has finished executing.',
    keyDefinitions: [
      { term: 'Lexical Scope', definition: 'Where a variable is declared in source code determines where it is accessible.' },
      { term: 'Closure', definition: 'A function that remembers and accesses variables from its lexical scope even when called outside that scope.' },
      { term: 'Encapsulation', definition: 'Hiding internal state from direct outside modification, exposing only controlled methods.' }
    ],
    codeWalkthrough: {
      language: 'javascript',
      code: `function createCounter() {\n    let count = 0; // private variable\n    return function() {\n        count++;\n        return count;\n    };\n}\nconst counter = createCounter();\nconsole.log(counter()); // 1\nconsole.log(counter()); // 2`,
      annotations: [
        { line: 1, note: 'createCounter defines an outer lexical scope.' },
        { line: 2, note: 'count is private to this scope; external code cannot do counter.count = 99.' },
        { line: 3, note: 'The returned inner function forms a closure over `count`.' },
        { line: 8, note: 'Even though createCounter finished, counter() still reads and mutates count.' }
      ]
    },
    walkthroughSteps: [
      {
        step: 1,
        title: 'The Outer Factory Function',
        codeSnippet: `function createCounter() {\n    let count = 0; // private variable\n    return function() {\n        count++;\n        return count;\n    };\n}\nconst counter = createCounter();\nconsole.log(counter()); // 1\nconsole.log(counter()); // 2`,
        language: 'javascript',
        highlightLines: [1, 2],
        explanation: '`createCounter` defines an outer scope containing `let count = 0`. Outside code has no direct way to access or change `count`.',
        mentalModelNote: 'Variables declared with let inside a function are shielded from global scope (encapsulation).',
        traceTable: [
          { iteration: 'Outer Call', currentValue: 'count = 0', condition: 'Local scope allocated', updatedValue: 'count initialized to 0' }
        ]
      },
      {
        step: 2,
        title: 'Returning the Inner Function (Closure)',
        codeSnippet: `function createCounter() {\n    let count = 0; // private variable\n    return function() {\n        count++;\n        return count;\n    };\n}\nconst counter = createCounter();\nconsole.log(counter()); // 1\nconsole.log(counter()); // 2`,
        language: 'javascript',
        highlightLines: [3, 4, 5],
        explanation: 'The function returns a new anonymous inner function. Because the inner function references `count`, JavaScript bundles the function together with its surrounding scope: this bundle is a Closure.',
        mentalModelNote: 'A closure is like a function carrying an invisible backpack holding the variables from the room where it was born.',
        traceTable: [
          { iteration: 'Return', currentValue: 'inner function', condition: 'Closure formed over count', updatedValue: 'counter variable holds closure' }
        ]
      },
      {
        step: 3,
        title: 'Invoking the Closure Across Time',
        codeSnippet: `function createCounter() {\n    let count = 0; // private variable\n    return function() {\n        count++;\n        return count;\n    };\n}\nconst counter = createCounter();\nconsole.log(counter()); // 1\nconsole.log(counter()); // 2`,
        language: 'javascript',
        highlightLines: [8, 9],
        explanation: 'Even though `createCounter()` has finished, calling `counter()` still increments and returns the private `count`. First call returns 1, second call returns 2.',
        mentalModelNote: 'Closures keep variables alive in memory as long as the returned function is referenced.',
        traceTable: [
          { iteration: '1st counter()', currentValue: 'count = 0', condition: 'count++ executes', updatedValue: 'Returns 1, count is now 1' },
          { iteration: '2nd counter()', currentValue: 'count = 1', condition: 'count++ executes', updatedValue: 'Returns 2, count is now 2' }
        ]
      }
    ],
    commonPitfalls: [
      {
        title: 'Accidental Shared State in Loops with var',
        explanation: 'Using `var` in a loop shares a single function-scoped variable across all closures. Always use `let`, which creates a fresh binding per iteration.',
        example: 'for (let i = 0; ...) creates a fresh closure per iteration.'
      },
      {
        title: 'Unintended Memory Retention via Stale Closures',
        explanation: 'A closure retains references to every variable in its outer lexical scope. If an event listener holds onto a large array or DOM node, it prevents garbage collection until removed.',
        example: 'Remove event listeners or nullify large references when no longer needed.'
      }
    ],
    exercises: [
      {
        id: 'js-close-q1',
        type: 'code_tracing',
        concept: 'function_factories',
        difficulty: 'foundational',
        language: 'javascript',
        prompt: 'What will be output to the console when this script runs?',
        codeSnippet: `function makeMultiplier(factor) {\n    return function(number) {\n        return number * factor;\n    };\n}\nconst double = makeMultiplier(2);\nconst triple = makeMultiplier(3);\nconsole.log(double(5) + triple(4));`,
        choices: ['22', '20', '30', 'NaN'],
        correctIndex: 0,
        hints: [
          'Calculate double(5): 5 * 2 = 10.',
          'Calculate triple(4): 4 * 3 = 12.',
          'Sum the two results: 10 + 12.'
        ],
        explanation: '`double` closes over `factor = 2`, so `double(5)` returns 10. `triple` closes over `factor = 3`, so `triple(4)` returns 12. 10 + 12 = 22.',
        misconceptions: {
          1: 'Did you multiply by factor 2 for both? Each multiplier maintains its own distinct closure scope.'
        }
      },
      {
        id: 'js-close-q2',
        type: 'conceptual',
        concept: 'state_encapsulation',
        difficulty: 'foundational',
        language: 'javascript',
        prompt: 'How do closures provide data privacy in JavaScript modules?',
        choices: [
          'Variables declared inside the outer function cannot be accessed directly from the outside, only through returned methods.',
          'Closures encrypt variables in memory using AES.',
          'Variables in closures are automatically marked read-only by the browser.',
          'They prevent the browser console from opening.'
        ],
        correctIndex: 0,
        hints: [
          'Think about what code outside the function can and cannot see.',
          'Lexical scope prevents outside callers from touching local variables.'
        ],
        explanation: 'Variables declared inside an outer function are not accessible in global scope. By only exposing specific getter/setter functions via closure, the internal state remains private.',
        misconceptions: {
          1: 'Closures do not use cryptographic encryption; privacy is enforced through lexical scoping rules in the JS engine.'
        }
      }
    ]
  },

  // =========================================================================
  // 4. SQL: FILTERING, AGGREGATION & JOINS
  // =========================================================================
  {
    id: 'sql-joins-filtering',
    skillSlug: 'sql',
    language: 'sql',
    title: 'SQL Relational Joins & Aggregations',
    subtitle: 'Combining data across tables with INNER JOIN, LEFT JOIN, and GROUP BY',
    topic: 'sql_joins',
    difficulty: 'foundational',
    estimatedMinutes: '14 mins',
    whyItMatters: 'Real-world relational databases split data into normalized tables (e.g. users, orders). Querying business insights requires joining tables and aggregating rows efficiently.',
    prerequisites: ['SELECT and WHERE basics', 'Primary keys vs Foreign keys'],
    concepts: ['inner_join', 'left_join', 'group_by_aggregation'],
    introduction: 'A JOIN clause combines columns from one or more tables based on a related column between them. Aggregations (like COUNT, SUM, AVG) collapse multiple rows into summary metrics, grouped by category.',
    keyDefinitions: [
      { term: 'INNER JOIN', definition: 'Returns only the rows where there is a match in both the left and right tables.' },
      { term: 'LEFT JOIN', definition: 'Returns all rows from the left table, and matching rows from the right table (with NULLs for unmatched right columns).' },
      { term: 'GROUP BY', definition: 'Groups rows that have the same values in specified columns into summary rows.' }
    ],
    codeWalkthrough: {
      language: 'sql',
      code: `SELECT u.name, COUNT(o.id) as order_count\nFROM users u\nLEFT JOIN orders o ON u.id = o.user_id\nGROUP BY u.name;`,
      annotations: [
        { line: 1, note: 'We select user name and count their total orders.' },
        { line: 2, note: 'users is the left table (u).' },
        { line: 3, note: 'LEFT JOIN ensures users with 0 orders are still included with count 0 instead of discarded.' },
        { line: 4, note: 'GROUP BY u.name collapses multiple orders per user into a single summarized row.' }
      ]
    },
    walkthroughSteps: [
      {
        step: 1,
        title: 'Identifying the Primary Left Table',
        codeSnippet: `SELECT u.name, COUNT(o.id) as order_count\nFROM users u\nLEFT JOIN orders o ON u.id = o.user_id\nGROUP BY u.name;`,
        language: 'sql',
        highlightLines: [2],
        explanation: 'We designate `users u` as the primary (left) table. In reporting, we usually want to include all registered users even if they have made zero orders.',
        mentalModelNote: 'In a LEFT JOIN, every row from the left table is guaranteed to appear in the output.',
        traceTable: [
          { iteration: 'From', currentValue: 'users u', condition: 'Left Table', updatedValue: 'All users preserved' }
        ]
      },
      {
        step: 2,
        title: 'Connecting Related Rows with LEFT JOIN',
        codeSnippet: `SELECT u.name, COUNT(o.id) as order_count\nFROM users u\nLEFT JOIN orders o ON u.id = o.user_id\nGROUP BY u.name;`,
        language: 'sql',
        highlightLines: [3],
        explanation: 'The join matches `u.id = o.user_id`. If user "Alice" has 2 orders, both orders match. If user "Bob" has 0 orders, the order fields become NULL instead of being dropped.',
        mentalModelNote: 'INNER JOIN silently deletes users with 0 orders. LEFT JOIN keeps them with NULL values.',
        traceTable: [
          { iteration: 'Alice', currentValue: 'Orders in DB: 2', condition: 'u.id = o.user_id', updatedValue: '2 rows matched' },
          { iteration: 'Bob', currentValue: 'Orders in DB: 0', condition: 'u.id = o.user_id', updatedValue: '1 row with NULL order' }
        ]
      },
      {
        step: 3,
        title: 'Aggregating & Grouping Summary Metrics',
        codeSnippet: `SELECT u.name, COUNT(o.id) as order_count\nFROM users u\nLEFT JOIN orders o ON u.id = o.user_id\nGROUP BY u.name;`,
        language: 'sql',
        highlightLines: [1, 4],
        explanation: '`GROUP BY u.name` groups Alice’s rows together and Bob’s row together. `COUNT(o.id)` counts order IDs: Alice gets 2, Bob gets 0 (because COUNT ignores NULLs!).',
        mentalModelNote: 'COUNT(column) ignores NULLs, while COUNT(*) counts all rows. Use COUNT(o.id) for accurate counts on left joins.',
        traceTable: [
          { iteration: 'Group Alice', currentValue: '2 matched order IDs', condition: 'COUNT(o.id)', updatedValue: 'order_count = 2' },
          { iteration: 'Group Bob', currentValue: 'NULL order ID', condition: 'COUNT(o.id)', updatedValue: 'order_count = 0' }
        ]
      }
    ],
    commonPitfalls: [
      {
        title: 'Selecting Non-Aggregated Columns Without GROUP BY',
        explanation: 'In SQL, if you use COUNT() or SUM(), every non-aggregated column in the SELECT list must appear in the GROUP BY clause.',
        example: 'SELECT department, title, COUNT(*) ... requires GROUP BY department, title.'
      },
      {
        title: 'Confusing INNER JOIN with LEFT JOIN for Missing Keys',
        explanation: 'Using INNER JOIN when records might have optional relationships silently drops rows (e.g., users with 0 orders disappear). Use LEFT JOIN when preserving all rows from the primary table.',
        example: 'Use LEFT JOIN when you want to report on entities that may have zero matching records.'
      }
    ],
    exercises: [
      {
        id: 'sql-join-q1',
        type: 'conceptual',
        concept: 'left_join',
        difficulty: 'foundational',
        language: 'sql',
        prompt: 'If you want a list of all students, including those who have not yet submitted any assignments, which join should you use between `students` (left) and `submissions` (right)?',
        choices: [
          'LEFT JOIN submissions ON students.id = submissions.student_id',
          'INNER JOIN submissions ON students.id = submissions.student_id',
          'RIGHT JOIN students ON students.id = submissions.student_id',
          'CROSS JOIN submissions'
        ],
        correctIndex: 0,
        hints: [
          'We need ALL records from the students table, even if submissions has 0 matches.',
          'Which join preserves all rows from the left table?'
        ],
        explanation: 'A LEFT JOIN retains all rows from the left table (`students`), even if there are no corresponding rows in the right table (`submissions`). Unmatched submission columns will be NULL.',
        misconceptions: {
          1: 'INNER JOIN would discard any student who has 0 submissions.'
        }
      },
      {
        id: 'sql-join-q2',
        type: 'code_tracing',
        concept: 'group_by_aggregation',
        difficulty: 'foundational',
        language: 'sql',
        prompt: 'Consider a table `sales`: Product A ($10), Product B ($20), Product A ($15). What is the output of `SELECT product, SUM(amount) FROM sales GROUP BY product;`?',
        choices: [
          'Product A: 25, Product B: 20',
          'Product A: 10, Product B: 20',
          'Product A: 2, Product B: 1',
          '45 (single row)'
        ],
        correctIndex: 0,
        hints: [
          'Group the rows by product name.',
          'Add the amounts for Product A: 10 + 15 = 25.',
          'Product B has a single sale: 20.'
        ],
        explanation: '`GROUP BY product` groups the two Product A rows together and computes SUM(10 + 15) = 25. Product B sums to 20.',
        misconceptions: {
          2: 'That would be COUNT(*), not SUM(amount).'
        }
      }
    ]
  }
];

export function getLessonById(id: string): LessonDefinition | undefined {
  return LESSONS_CATALOG.find((l) => l.id === id);
}

export function getLessonsForSkill(skillSlug: string): LessonDefinition[] {
  return LESSONS_CATALOG.filter((l) => l.skillSlug === skillSlug);
}

export function getDefaultLessonForSkill(skillSlug: string): LessonDefinition {
  const matches = getLessonsForSkill(skillSlug);
  if (matches.length > 0) return matches[0];
  return LESSONS_CATALOG[0];
}
