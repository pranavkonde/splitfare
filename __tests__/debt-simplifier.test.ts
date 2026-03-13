import { describe, it, expect } from "vitest";
import { simplifyDebts } from "../lib/debt-simplifier";

describe("Debt Simplifier", () => {
  it("should simplify debts for 3 people", () => {
    // A owes B 10, B owes C 10
    // Simplified: A owes C 10
    const balances = {
      "u1": -10, // Debtor
      "u2": 0,   // Middleman
      "u3": 10,  // Creditor
    };

    const result = simplifyDebts(balances);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ from: "u1", to: "u3", amount: 10 });
  });

  it("should simplify complex debts", () => {
    // Alice owes 20, Bob owes 10, Charlie is owed 30
    const balances = {
      "u1": -20,
      "u2": -10,
      "u3": 30,
    };

    const result = simplifyDebts(balances);
    expect(result).toHaveLength(2);
    expect(result.find(r => r.from === "u1")).toEqual({ from: "u1", to: "u3", amount: 20 });
    expect(result.find(r => r.from === "u2")).toEqual({ from: "u2", to: "u3", amount: 10 });
  });

  it("should handle multi-person settlement", () => {
    // Alice owes 100, Bob is owed 60, Charlie is owed 40
    const balances = {
      "u1": -100,
      "u2": 60,
      "u3": 40,
    };

    const result = simplifyDebts(balances);
    expect(result).toHaveLength(2);
    expect(result.find(r => r.to === "u2")).toEqual({ from: "u1", to: "u2", amount: 60 });
    expect(result.find(r => r.to === "u3")).toEqual({ from: "u1", to: "u3", amount: 40 });
  });

  it("should return empty array for 0 balances", () => {
    const balances = {
      "u1": 0,
      "u2": 0,
    };

    const result = simplifyDebts(balances);
    expect(result).toEqual([]);
  });

  it("should handle precision issues", () => {
    const balances = {
      "u1": -0.000001,
      "u2": 0.000001,
    };

    const result = simplifyDebts(balances);
    expect(result).toEqual([]);
  });

  it("should handle one person owing everyone", () => {
    const balances = {
      "u1": -100,
      "u2": 25,
      "u3": 25,
      "u4": 25,
      "u5": 25,
    };

    const result = simplifyDebts(balances);
    expect(result).toHaveLength(4);
    result.forEach(r => {
      expect(r.from).toBe("u1");
      expect(r.amount).toBe(25);
    });
  });

  it("should handle everyone owing one person", () => {
    const balances = {
      "u1": 100,
      "u2": -25,
      "u3": -25,
      "u4": -25,
      "u5": -25,
    };

    const result = simplifyDebts(balances);
    expect(result).toHaveLength(4);
    result.forEach(r => {
      expect(r.to).toBe("u1");
      expect(r.amount).toBe(25);
    });
  });

  it("should handle many small debts", () => {
    const balances = {
      "u1": -0.1,
      "u2": -0.2,
      "u3": -0.3,
      "u4": 0.6,
    };

    const result = simplifyDebts(balances);
    expect(result).toHaveLength(3);
    expect(result.reduce((sum, r) => sum + r.amount, 0)).toBeCloseTo(0.6);
  });

  it("should minimize transactions", () => {
    // A owes B 10, B owes C 10, C owes D 10
    // Net: A: -10, B: 0, C: 0, D: 10
    // Simplified: A owes D 10 (1 transaction)
    const balances = {
      "A": -10,
      "B": 0,
      "C": 0,
      "D": 10,
    };

    const result = simplifyDebts(balances);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ from: "A", to: "D", amount: 10 });
  });

  it("should handle complex 5-person settlement", () => {
    const balances = {
      "u1": -50,
      "u2": -30,
      "u3": 20,
      "u4": 40,
      "u5": 20,
    };

    const result = simplifyDebts(balances);
    // u1 (50) owes u4 (40) and u3 (10)
    // u2 (30) owes u5 (20) and u3 (10)
    // Total 4 transactions (or maybe fewer depending on sorting)
    expect(result.length).toBeLessThanOrEqual(4);
    
    const totalSent = result.reduce((sum, r) => sum + r.amount, 0);
    expect(totalSent).toBeCloseTo(80);
    
    const finalBalances: Record<string, number> = { ...balances };
    result.forEach(r => {
      finalBalances[r.from] += r.amount;
      finalBalances[r.to] -= r.amount;
    });
    
    Object.values(finalBalances).forEach(b => {
      expect(Math.abs(b)).toBeLessThan(0.01);
    });
  });
});
