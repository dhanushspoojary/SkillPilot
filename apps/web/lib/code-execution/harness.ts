import type { ProgrammingLanguage } from './types.ts';

/**
 * Builds executable source code by attaching a problem-specific test harness
 * that parses test case input from stdin and prints output to stdout.
 */
export function buildExecutableProgram(
  userCode: string,
  problemId: string,
  language: ProgrammingLanguage,
  stdin: string
): { sourceCode: string; stdin: string } {
  // If user code already includes a standalone entrypoint (e.g. `if __name__ == '__main__':` or `main(`),
  // we pass it directly with stdin.
  if (
    (language === 'python' && userCode.includes('__main__')) ||
    (language === 'javascript' && (userCode.includes('process.stdin') || userCode.includes('readFileSync(0)'))) ||
    ((language === 'c' || language === 'cpp') && userCode.includes('main(')) ||
    (language === 'java' && userCode.includes('main(String[]'))
  ) {
    return { sourceCode: userCode, stdin };
  }

  const cleanProblemId = problemId.replace(/^prob-/, '');

  if (language === 'python') {
    return wrapPython(userCode, cleanProblemId, stdin);
  } else if (language === 'javascript') {
    return wrapJavaScript(userCode, cleanProblemId, stdin);
  } else if (language === 'c') {
    return wrapC(userCode, cleanProblemId, stdin);
  } else if (language === 'cpp') {
    return wrapCpp(userCode, cleanProblemId, stdin);
  } else if (language === 'java') {
    return wrapJava(userCode, cleanProblemId, stdin);
  } else if (language === 'sql') {
    return wrapSql(userCode, cleanProblemId, stdin);
  }

  return { sourceCode: userCode, stdin };
}

function wrapPython(code: string, problem: string, stdin: string): { sourceCode: string; stdin: string } {
  const harness = `
import sys, json

class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def _list_to_nodes(arr):
    dummy = ListNode(0)
    curr = dummy
    for x in arr:
        curr.next = ListNode(x)
        curr = curr.next
    return dummy.next

def _nodes_to_list(head):
    res = []
    curr = head
    while curr:
        res.append(curr.val)
        curr = curr.next
    return res

if __name__ == '__main__':
    raw = sys.stdin.read().strip()
    try:
        if "${problem}" == "two-sum-target":
            split_idx = raw.rfind("],")
            if split_idx != -1:
                nums = json.loads(raw[:split_idx + 1])
                target = int(raw[split_idx + 2:].strip())
            else:
                parsed = json.loads(raw)
                nums = parsed[0]
                target = int(parsed[1])
            fn = globals().get("two_sum") or globals().get("twoSum") or globals().get("solution")
            if not fn:
                raise Exception("Function two_sum or solution not defined")
            out = fn(nums, target)
            print(json.dumps(out))
        elif "${problem}" == "reverse-linked-list":
            arr = json.loads(raw)
            head = _list_to_nodes(arr)
            fn = globals().get("reverse_list") or globals().get("reverseList") or globals().get("solution")
            if not fn:
                raise Exception("Function reverse_list or solution not defined")
            out_head = fn(head)
            print(json.dumps(_nodes_to_list(out_head)))
        elif "${problem}" == "valid-parentheses":
            val = json.loads(raw) if (raw.startswith('"') and raw.endswith('"')) else raw.strip()
            fn = globals().get("is_valid") or globals().get("isValid") or globals().get("solution")
            if not fn:
                raise Exception("Function is_valid or solution not defined")
            print("true" if fn(val) else "false")
        elif "${problem}" == "maximum-subarray":
            arr = json.loads(raw)
            fn = globals().get("max_sub_array") or globals().get("maxSubArray") or globals().get("solution")
            if not fn:
                raise Exception("Function max_sub_array or solution not defined")
            print(fn(arr))
        else:
            print("Unknown problem harness")
    except Exception as e:
        sys.stderr.write(f"Harness execution error: {e}\\n")
        sys.exit(1)
`;
  return {
    sourceCode: `${code}\n${harness}`,
    stdin,
  };
}

function wrapJavaScript(code: string, problem: string, stdin: string): { sourceCode: string; stdin: string } {
  const harness = `
const fs = require('fs');

function _listToNodes(arr) {
  let dummy = { val: 0, next: null };
  let curr = dummy;
  for (const x of arr) {
    curr.next = { val: x, next: null };
    curr = curr.next;
  }
  return dummy.next;
}

function _nodesToList(head) {
  const res = [];
  let curr = head;
  while (curr) {
    res.push(curr.val);
    curr = curr.next;
  }
  return res;
}

try {
  const raw = fs.readFileSync(0, 'utf-8').trim();
  if ("${problem}" === "two-sum-target") {
    const splitIdx = raw.lastIndexOf('],');
    let nums, target;
    if (splitIdx !== -1) {
      nums = JSON.parse(raw.slice(0, splitIdx + 1));
      target = parseInt(raw.slice(splitIdx + 2).trim(), 10);
    } else {
      const parsed = JSON.parse(raw);
      nums = parsed[0];
      target = parseInt(parsed[1], 10);
    }
    const fn = typeof twoSum === 'function' ? twoSum : typeof two_sum === 'function' ? two_sum : typeof solution === 'function' ? solution : null;
    if (!fn) throw new Error("Function twoSum or solution not defined");
    console.log(JSON.stringify(fn(nums, target)));
  } else if ("${problem}" === "reverse-linked-list") {
    const arr = JSON.parse(raw);
    const head = _listToNodes(arr);
    const fn = typeof reverseList === 'function' ? reverseList : typeof reverse_list === 'function' ? reverse_list : typeof solution === 'function' ? solution : null;
    if (!fn) throw new Error("Function reverseList or solution not defined");
    console.log(JSON.stringify(_nodesToList(fn(head))));
  } else if ("${problem}" === "valid-parentheses") {
    const val = (raw.startsWith('"') && raw.endsWith('"')) ? JSON.parse(raw) : raw;
    const fn = typeof isValid === 'function' ? isValid : typeof is_valid === 'function' ? is_valid : typeof solution === 'function' ? solution : null;
    if (!fn) throw new Error("Function isValid or solution not defined");
    console.log(fn(val) ? "true" : "false");
  } else if ("${problem}" === "maximum-subarray") {
    const arr = JSON.parse(raw);
    const fn = typeof maxSubArray === 'function' ? maxSubArray : typeof max_sub_array === 'function' ? max_sub_array : typeof solution === 'function' ? solution : null;
    if (!fn) throw new Error("Function maxSubArray or solution not defined");
    console.log(fn(arr));
  } else {
    console.log("Unknown problem harness");
  }
} catch (err) {
  console.error("Harness error: " + (err && err.message ? err.message : String(err)));
  process.exit(1);
}
`;
  return {
    sourceCode: `${code}\n${harness}`,
    stdin,
  };
}

function wrapC(code: string, problem: string, stdin: string): { sourceCode: string; stdin: string } {
  // Simple C driver for standard problems
  if (problem === 'maximum-subarray') {
    const harness = `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main() {
    int nums[1000];
    int count = 0;
    char line[4096];
    if (!fgets(line, sizeof(line), stdin)) return 0;
    char* p = line;
    while (*p) {
        if (*p == '-' || (*p >= '0' && *p <= '9')) {
            nums[count++] = (int)strtol(p, &p, 10);
        } else {
            p++;
        }
    }
    printf("%d\\n", maxSubArray(nums, count));
    return 0;
}
`;
    return { sourceCode: `${code}\n${harness}`, stdin };
  }
  return { sourceCode: code, stdin };
}

function wrapCpp(code: string, problem: string, stdin: string): { sourceCode: string; stdin: string } {
  if (problem === 'maximum-subarray') {
    const harness = `
#include <iostream>
#include <vector>
#include <string>
#include <sstream>

int main() {
    std::string line;
    if (std::getline(std::cin, line)) {
        std::vector<int> nums;
        for (size_t i = 0; i < line.size(); ++i) {
            if (line[i] == '-' || (line[i] >= '0' && line[i] <= '9')) {
                size_t nextIdx = 0;
                int val = std::stoi(line.substr(i), &nextIdx);
                nums.push_back(val);
                i += (nextIdx > 0 ? nextIdx - 1 : 0);
            }
        }
        std::cout << maxSubArray(nums) << std::endl;
    }
    return 0;
}
`;
    return { sourceCode: `${code}\n${harness}`, stdin };
  }
  return { sourceCode: code, stdin };
}

function wrapJava(code: string, problem: string, stdin: string): { sourceCode: string; stdin: string } {
  if (problem === 'maximum-subarray') {
    const harness = `
import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        String line = reader.readLine();
        if (line == null) return;
        line = line.replaceAll("[\\[\\],]", " ").trim();
        if (line.isEmpty()) return;
        String[] parts = line.split("\\\\s+");
        int[] nums = new int[parts.length];
        for (int i = 0; i < parts.length; i++) {
            nums[i] = Integer.parseInt(parts[i]);
        }
        Solution sol = new Solution();
        System.out.println(sol.maxSubArray(nums));
    }
}
`;
    return { sourceCode: `${code}\n${harness}`, stdin };
  }
  return { sourceCode: code, stdin };
}


function wrapSql(query: string, problem: string, stdin: string): { sourceCode: string; stdin: string } {
  // Build a self-contained SQLite script for isolated evaluation
  const parsedRows = (() => {
    try {
      return JSON.parse(stdin);
    } catch {
      return [[1, 100], [2, 200], [3, 300]];
    }
  })();

  const insertStatements = Array.isArray(parsedRows)
    ? parsedRows.map((r: any) => `INSERT INTO Employee (id, salary) VALUES (${r[0]}, ${r[1]});`).join('\n')
    : '';

  const cleanQuery = query.trim().replace(/;+$/, '');

  const sqlScript = `
CREATE TABLE Employee (id INTEGER PRIMARY KEY, salary INTEGER);
${insertStatements}
.headers off
.mode list
.nullvalue null
SELECT COALESCE((${cleanQuery}), 'null');
`;

  return { sourceCode: sqlScript, stdin: '' };
}
