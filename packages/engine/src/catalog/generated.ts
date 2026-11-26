// AUTO-GENERADO por packages/engine/scripts/build-catalog.ts — no editar a mano.
// Fuente: docs/engine/rules/*.yaml

export const CATALOG_VERSION = "1.0.0";
export const ZONES_YAML = {
  "catalog_version": "1.0.0",
  "reference_pitch": {
    "length_m": 105,
    "width_m": 68
  },
  "anchoring": {
    "goal_relative": [
      "Z_NEAR_POST",
      "Z_FAR_POST",
      "Z_GA_CENTER",
      "Z_PEN_SPOT",
      "Z_FAR_ZONE",
      "Z_EDGE",
      "Z_REBOUND",
      "Z_GK",
      "Z_START_CLUSTER"
    ],
    "corner_relative": [
      "Z_SHORT"
    ],
    "proportional": [
      "Z_REST"
    ]
  },
  "landmarks": {
    "GOAL_C": [
      105,
      34
    ],
    "POST_L": [
      105,
      30.34
    ],
    "POST_R": [
      105,
      37.66
    ],
    "PEN_SPOT": [
      94,
      34
    ],
    "CORNER_L": [
      105,
      0
    ],
    "CORNER_R": [
      105,
      68
    ],
    "GA": {
      "x": [
        99.5,
        105
      ],
      "y": [
        24.84,
        43.16
      ]
    },
    "PA": {
      "x": [
        88.5,
        105
      ],
      "y": [
        13.84,
        54.16
      ]
    }
  },
  "zones": {
    "Z_NEAR_POST": {
      "label": "Primer palo",
      "rect": {
        "x": [
          99.5,
          105
        ],
        "y": [
          26,
          32.5
        ]
      },
      "anchors": [
        [
          101.5,
          30.5
        ],
        [
          100,
          29
        ],
        [
          102.5,
          31.8
        ]
      ]
    },
    "Z_FAR_POST": {
      "label": "Segundo palo",
      "rect": {
        "x": [
          99.5,
          105
        ],
        "y": [
          36,
          42.5
        ]
      },
      "anchors": [
        [
          101.5,
          39.5
        ],
        [
          100,
          41
        ],
        [
          102.8,
          38
        ]
      ]
    },
    "Z_GA_CENTER": {
      "label": "Centro del área pequeña",
      "rect": {
        "x": [
          100,
          105
        ],
        "y": [
          32.5,
          36
        ]
      },
      "anchors": [
        [
          102,
          34.2
        ],
        [
          100.5,
          33.2
        ]
      ]
    },
    "Z_PEN_SPOT": {
      "label": "Punto de penalti",
      "rect": {
        "x": [
          92,
          97
        ],
        "y": [
          30,
          38
        ]
      },
      "anchors": [
        [
          94,
          34
        ],
        [
          95.5,
          36.5
        ],
        [
          95.5,
          31.5
        ]
      ]
    },
    "Z_FAR_ZONE": {
      "label": "Fuera del segundo palo",
      "rect": {
        "x": [
          96,
          101
        ],
        "y": [
          42.5,
          49
        ]
      },
      "anchors": [
        [
          98.5,
          45
        ],
        [
          97,
          47.5
        ]
      ]
    },
    "Z_EDGE": {
      "label": "Frontal del área",
      "rect": {
        "x": [
          83,
          88.5
        ],
        "y": [
          24,
          44
        ]
      },
      "anchors": [
        [
          86,
          34
        ],
        [
          86,
          29
        ],
        [
          86,
          39
        ]
      ]
    },
    "Z_REBOUND": {
      "label": "Zona de rechace",
      "rect": {
        "x": [
          82,
          89
        ],
        "y": [
          20,
          48
        ]
      },
      "anchors": [
        [
          86.5,
          30
        ],
        [
          86.5,
          38
        ],
        [
          84,
          24
        ],
        [
          84,
          44
        ]
      ]
    },
    "Z_GK": {
      "label": "Junto al portero rival",
      "rect": {
        "x": [
          103.5,
          105
        ],
        "y": [
          32,
          36
        ]
      },
      "anchors": [
        [
          104,
          34.6
        ]
      ]
    },
    "Z_SHORT": {
      "label": "Opción de corto",
      "rect": {
        "x": [
          94,
          103
        ],
        "y": [
          0,
          8
        ]
      },
      "anchors": [
        [
          100,
          5
        ],
        [
          97,
          7
        ]
      ]
    },
    "Z_REST": {
      "label": "Vigilancia",
      "rect": {
        "x": [
          55,
          72
        ],
        "y": [
          10,
          58
        ]
      },
      "anchors": [
        [
          65,
          24
        ],
        [
          65,
          44
        ],
        [
          60,
          34
        ]
      ]
    },
    "Z_START_CLUSTER": {
      "label": "Salida agrupada",
      "rect": {
        "x": [
          90,
          94
        ],
        "y": [
          34,
          42
        ]
      },
      "anchors": [
        [
          92,
          36
        ],
        [
          92.5,
          38
        ],
        [
          91.5,
          40
        ],
        [
          93,
          41
        ]
      ]
    }
  },
  "placement": {
    "min_spacing_m": 1,
    "fallback_grid_step_m": 1,
    "fallback_order": "x desc, |y - anchor0.y| asc, y asc",
    "rounding_decimals_normalized": 4
  }
} as const;
export const ROLES_YAML = {
  "catalog_version": "1.0.0",
  "roles": {
    "TAKER": {
      "label": "Lanzador",
      "phases": [
        "SP_ATT"
      ],
      "movements": [],
      "suitability": [
        {
          "factor": "setpiece_role",
          "value": "corner_taker_{side}",
          "weight": 60
        },
        {
          "factor": "tag",
          "value": "set_piece_specialist",
          "weight": 30
        },
        {
          "factor": "foot_matches_requested_swing",
          "weight": 10
        }
      ]
    },
    "PRIMARY_TARGET": {
      "label": "Rematador principal",
      "phases": [
        "SP_ATT"
      ],
      "movements": [
        "ATTACK_NEAR_POST",
        "ATTACK_FAR_POST",
        "ATTACK_PEN_SPOT",
        "ATTACK_GA_CENTER",
        "CROSS_RUN",
        "LATE_ARRIVAL",
        "RUN_IN_BEHIND"
      ],
      "suitability": [
        {
          "factor": "tag",
          "value": "aerial",
          "weight": 40
        },
        {
          "factor": "height_norm",
          "weight": 40
        },
        {
          "factor": "setpiece_role",
          "value": "primary_target",
          "weight": 20
        }
      ]
    },
    "SECONDARY_TARGET": {
      "label": "Rematador secundario",
      "phases": [
        "SP_ATT"
      ],
      "movements": [
        "ATTACK_NEAR_POST",
        "ATTACK_FAR_POST",
        "ATTACK_PEN_SPOT",
        "ATTACK_GA_CENTER",
        "CROSS_RUN",
        "LATE_ARRIVAL"
      ],
      "suitability": [
        {
          "factor": "tag",
          "value": "aerial",
          "weight": 30
        },
        {
          "factor": "height_norm",
          "weight": 30
        },
        {
          "factor": "tag",
          "value": "finishing",
          "weight": 20
        },
        {
          "factor": "position_in",
          "value": [
            "ST",
            "CB"
          ],
          "weight": 20
        }
      ]
    },
    "BLOCKER": {
      "label": "Bloqueador (pantalla)",
      "phases": [
        "SP_ATT"
      ],
      "movements": [
        "SCREEN"
      ],
      "suitability": [
        {
          "factor": "tag",
          "value": "physical",
          "weight": 40
        },
        {
          "factor": "height_norm",
          "weight": 30
        },
        {
          "factor": "position_in",
          "value": [
            "CB",
            "DM"
          ],
          "weight": 30
        }
      ]
    },
    "DECOY": {
      "label": "Jugador de arrastre",
      "phases": [
        "SP_ATT"
      ],
      "movements": [
        "DECOY_RUN"
      ],
      "suitability": [
        {
          "factor": "tag",
          "value": "pace",
          "weight": 40
        },
        {
          "factor": "position_in",
          "value": [
            "ST",
            "RW",
            "LW"
          ],
          "weight": 30
        },
        {
          "factor": "tag",
          "value": "aerial",
          "weight": 30
        }
      ]
    },
    "SHORT_RECEIVER": {
      "label": "Receptor de saque corto",
      "phases": [
        "SP_ATT"
      ],
      "movements": [
        "SHORT_OPTION"
      ],
      "suitability": [
        {
          "factor": "tag",
          "value": "technical",
          "weight": 50
        },
        {
          "factor": "position_in",
          "value": [
            "RW",
            "LW",
            "AM",
            "CM"
          ],
          "weight": 50
        }
      ]
    },
    "REBOUND": {
      "label": "Rechace",
      "phases": [
        "SP_ATT"
      ],
      "movements": [
        "HOLD",
        "LATE_ARRIVAL"
      ],
      "suitability": [
        {
          "factor": "tag",
          "value": "long_shot",
          "weight": 50
        },
        {
          "factor": "position_in",
          "value": [
            "CM",
            "AM",
            "DM"
          ],
          "weight": 50
        }
      ]
    },
    "REST_DEFENDER": {
      "label": "Vigilancia",
      "phases": [
        "SP_ATT"
      ],
      "movements": [
        "HOLD"
      ],
      "suitability": [
        {
          "factor": "position_in",
          "value": [
            "CB",
            "RB",
            "LB",
            "DM"
          ],
          "weight": 50
        },
        {
          "factor": "tag",
          "value": "pace",
          "weight": 50
        }
      ]
    },
    "GK_SCREEN": {
      "label": "Molestar al portero",
      "phases": [
        "SP_ATT"
      ],
      "movements": [
        "HOLD"
      ],
      "suitability": [
        {
          "factor": "tag",
          "value": "physical",
          "weight": 60
        },
        {
          "factor": "height_norm",
          "weight": 40
        }
      ]
    },
    "COVER": {
      "label": "Cobertura",
      "phases": [
        "SP_ATT",
        "SP_DEF"
      ],
      "movements": [
        "HOLD"
      ],
      "suitability": [
        {
          "factor": "position_in",
          "value": [
            "DM",
            "CM",
            "CB"
          ],
          "weight": 100
        }
      ]
    },
    "ZONAL_DEFENDER": {
      "label": "Defensor en zona",
      "phases": [
        "SP_DEF"
      ],
      "movements": [
        "HOLD"
      ],
      "suitability": [
        {
          "factor": "tag",
          "value": "aerial",
          "weight": 50
        },
        {
          "factor": "height_norm",
          "weight": 50
        }
      ]
    },
    "MAN_MARKER": {
      "label": "Marcador individual",
      "phases": [
        "SP_DEF"
      ],
      "movements": [
        "FOLLOW"
      ],
      "suitability": [
        {
          "factor": "tag",
          "value": "aerial",
          "weight": 40
        },
        {
          "factor": "position_in",
          "value": [
            "CB",
            "DM",
            "RB",
            "LB"
          ],
          "weight": 30
        },
        {
          "factor": "height_norm",
          "weight": 30
        }
      ]
    },
    "POST_GUARD": {
      "label": "Hombre de palo",
      "phases": [
        "SP_DEF"
      ],
      "movements": [
        "HOLD"
      ],
      "suitability": [
        {
          "factor": "position_in",
          "value": [
            "RB",
            "LB",
            "CM"
          ],
          "weight": 100
        }
      ]
    },
    "EDGE_GUARD": {
      "label": "Defensor de frontal",
      "phases": [
        "SP_DEF"
      ],
      "movements": [
        "HOLD"
      ],
      "suitability": [
        {
          "factor": "position_in",
          "value": [
            "CM",
            "AM",
            "DM"
          ],
          "weight": 100
        }
      ]
    },
    "COUNTER_OUTLET": {
      "label": "Salida a la contra",
      "phases": [
        "SP_DEF"
      ],
      "movements": [
        "HOLD"
      ],
      "suitability": [
        {
          "factor": "tag",
          "value": "pace",
          "weight": 60
        },
        {
          "factor": "position_in",
          "value": [
            "ST",
            "RW",
            "LW"
          ],
          "weight": 40
        }
      ]
    },
    "WALL": {
      "label": "Barrera",
      "phases": [
        "SP_DEF"
      ],
      "movements": [
        "HOLD"
      ],
      "suitability": [
        {
          "factor": "height_norm",
          "weight": 60
        },
        {
          "factor": "tag",
          "value": "physical",
          "weight": 40
        }
      ]
    },
    "GOALKEEPER": {
      "label": "Portero",
      "phases": [
        "ALL"
      ],
      "movements": [
        "HOLD"
      ],
      "suitability": [
        {
          "factor": "position_in",
          "value": [
            "GK"
          ],
          "weight": 100
        }
      ]
    }
  },
  "height_norm": {
    "min_cm": 165,
    "max_cm": 195,
    "missing": 50
  },
  "tie_break": [
    "score_desc",
    "shirt_number_asc",
    "player_id_asc"
  ],
  "team_preference_weight": 1000
} as const;
export const MOVEMENTS_YAML = {
  "catalog_version": "1.0.0",
  "speeds_mps": {
    "walk": 2,
    "jog": 4,
    "run": 5.5,
    "sprint": 7
  },
  "ball_speeds_mps": {
    "DRIVEN": 22,
    "LOFTED": 14,
    "LOW": 12,
    "SHORT": 12
  },
  "timeline": {
    "prep_start_s": -2.5,
    "end_after_arrival_s": 1
  },
  "movements": {
    "ATTACK_NEAR_POST": {
      "label": "Ataque al primer palo",
      "default_start_zone": "Z_START_CLUSTER",
      "end_zone": "Z_NEAR_POST",
      "shape": "CURVED_IN",
      "speed": "sprint",
      "anchor": {
        "kind": "ARRIVES_AT",
        "event": "BALL_ARRIVAL",
        "offset_s": 0
      }
    },
    "ATTACK_FAR_POST": {
      "label": "Ataque al segundo palo",
      "default_start_zone": "Z_PEN_SPOT",
      "end_zone": "Z_FAR_POST",
      "shape": "STRAIGHT",
      "speed": "sprint",
      "anchor": {
        "kind": "ARRIVES_AT",
        "event": "BALL_ARRIVAL",
        "offset_s": 0
      }
    },
    "ATTACK_PEN_SPOT": {
      "label": "Ataque al punto de penalti",
      "default_start_zone": "Z_EDGE",
      "end_zone": "Z_PEN_SPOT",
      "shape": "STRAIGHT",
      "speed": "sprint",
      "anchor": {
        "kind": "ARRIVES_AT",
        "event": "BALL_ARRIVAL",
        "offset_s": 0
      }
    },
    "ATTACK_GA_CENTER": {
      "label": "Ataque al centro del área pequeña",
      "default_start_zone": "Z_PEN_SPOT",
      "end_zone": "Z_GA_CENTER",
      "shape": "STRAIGHT",
      "speed": "sprint",
      "anchor": {
        "kind": "ARRIVES_AT",
        "event": "BALL_ARRIVAL",
        "offset_s": 0
      }
    },
    "RUN_IN_BEHIND": {
      "label": "Desmarque de ruptura",
      "default_start_zone": "current",
      "end_zone": "param",
      "shape": "STRAIGHT",
      "speed": "sprint",
      "anchor": {
        "kind": "STARTS_AT",
        "event": "KICK",
        "offset_s": -0.2
      }
    },
    "DECOY_RUN": {
      "label": "Movimiento de arrastre",
      "default_start_zone": "Z_START_CLUSTER",
      "end_zone": "away_from_target",
      "shape": "STRAIGHT",
      "speed": 6,
      "anchor": {
        "kind": "STARTS_AT",
        "event": "KICK",
        "offset_s": -0.6
      }
    },
    "SCREEN": {
      "label": "Bloqueo posicional",
      "default_start_zone": "current",
      "end_zone": "computed_screen_point",
      "shape": "STRAIGHT",
      "speed": "jog",
      "static_on_arrival": true,
      "anchor": {
        "kind": "ARRIVES_AT",
        "event": "MOVEMENT_START",
        "ref": "beneficiary_movement",
        "offset_s": -0.3
      },
      "constraints": [
        "SEQ-SCREEN-01",
        "LAW-IMP-01"
      ]
    },
    "CROSS_RUN": {
      "label": "Movimiento cruzado",
      "pair": true,
      "shape": "CURVED_OPPOSITE",
      "speed": "sprint",
      "anchor": {
        "kind": "ARRIVES_AT",
        "event": "BALL_ARRIVAL",
        "offset_s": 0
      }
    },
    "LATE_ARRIVAL": {
      "label": "Llegada desde segunda línea",
      "default_start_zone": "Z_EDGE",
      "end_zone": "Z_PEN_SPOT",
      "shape": "STRAIGHT",
      "speed": "sprint",
      "anchor": {
        "kind": "ARRIVES_AT",
        "event": "BALL_ARRIVAL",
        "offset_s": 0.3
      }
    },
    "CHECK_TO_BALL": {
      "label": "Venir a recibir",
      "default_start_zone": "current",
      "end_zone": "toward_ball_6m",
      "shape": "STRAIGHT",
      "speed": 5,
      "anchor": {
        "kind": "STARTS_AT",
        "event": "KICK",
        "offset_s": -0.5
      }
    },
    "SHORT_OPTION": {
      "label": "Ofrecer el corto",
      "default_start_zone": "Z_SHORT",
      "end_zone": "Z_SHORT_NEAR",
      "shape": "STRAIGHT",
      "speed": 5,
      "anchor": {
        "kind": "STARTS_AT",
        "event": "KICK",
        "offset_s": -1
      }
    },
    "HOLD": {
      "label": "Mantener posición",
      "shape": "NONE"
    },
    "FOLLOW": {
      "label": "Seguir a un rival",
      "derived_from": "marked_actor",
      "delay_s": 0.15,
      "goal_side_offset_m": 1
    }
  }
} as const;
export const TEMPLATES_YAML = {
  "catalog_version": "1.0.0",
  "templates": [
    {
      "template": "CRN_ATT_STANDARD",
      "type": "CORNER_ATT",
      "version": "1.0.0",
      "params": {
        "side": {
          "enum": [
            "LEFT",
            "RIGHT"
          ],
          "required": true
        },
        "swing": {
          "enum": [
            "INSWING",
            "OUTSWING"
          ],
          "default": "from_taker_foot"
        },
        "trajectory": {
          "enum": [
            "DRIVEN",
            "LOFTED"
          ],
          "default": "DRIVEN"
        },
        "target_zone": {
          "enum": [
            "Z_NEAR_POST",
            "Z_FAR_POST",
            "Z_GA_CENTER",
            "Z_PEN_SPOT"
          ],
          "default": "zone_of_primary_target_else_Z_FAR_POST"
        }
      },
      "ball_start": {
        "corner_offset_m": 0.5
      },
      "role_defaults": {
        "TAKER": {
          "count": 1,
          "rule": "CRN-POS-01"
        },
        "PRIMARY_TARGET": {
          "count": 1,
          "start_zone": "Z_START_CLUSTER",
          "movement": "ATTACK_TO_TARGET"
        },
        "SECONDARY_TARGET": {
          "count": 2,
          "start_zone": "Z_START_CLUSTER",
          "movements": [
            "ATTACK_NEAR_POST",
            "ATTACK_PEN_SPOT"
          ]
        },
        "DECOY": {
          "count": 1,
          "start_zone": "Z_START_CLUSTER",
          "movement": "DECOY_RUN"
        },
        "GK_SCREEN": {
          "count": 1,
          "start_zone": "Z_GK",
          "movement": "HOLD"
        },
        "REBOUND": {
          "count": 2,
          "start_zone": "Z_REBOUND",
          "movement": "HOLD"
        },
        "REST_DEFENDER": {
          "count": 2,
          "start_zone": "Z_REST",
          "movement": "HOLD",
          "rule": "CRN-POS-07"
        }
      },
      "fill_order": [
        "TAKER",
        "REST_DEFENDER",
        "PRIMARY_TARGET",
        "BLOCKER",
        "SECONDARY_TARGET",
        "REBOUND",
        "DECOY",
        "GK_SCREEN"
      ],
      "outfield_total": 10,
      "opponents_default": "OPP_CORNER_DEF_MIXED",
      "constraints": [
        "LAW-CRN-01",
        "LAW-CRN-02",
        "LAW-CRN-03",
        "GEO-01",
        "GEO-02",
        "GEO-03",
        "GEO-SPACING-01",
        "TECH-SWING-01",
        "TAC-CRN-REST-01",
        "TAC-CRN-TGT-01",
        "SEQ-SCREEN-01",
        "SCH-SYNC-01",
        "SEQ-CONSTR-01"
      ]
    },
    {
      "template": "OPP_CORNER_DEF_MIXED",
      "type": "CORNER_DEF",
      "team": "OPP",
      "version": "1.0.0",
      "description": "Defensa rival por defecto para visualizar un córner ofensivo. Representación genérica, no predicción.",
      "actors": [
        {
          "role": "GOALKEEPER",
          "at": [
            104.2,
            34
          ]
        },
        {
          "role": "ZONAL_DEFENDER",
          "at": [
            103.5,
            30
          ]
        },
        {
          "role": "ZONAL_DEFENDER",
          "at": [
            103.5,
            34
          ]
        },
        {
          "role": "ZONAL_DEFENDER",
          "at": [
            103.5,
            38
          ]
        },
        {
          "role": "ZONAL_DEFENDER",
          "at": [
            100.5,
            32
          ]
        },
        {
          "role": "ZONAL_DEFENDER",
          "at": [
            100.5,
            36.5
          ]
        },
        {
          "role": "ZONAL_DEFENDER",
          "at": [
            98,
            26
          ]
        },
        {
          "role": "MAN_MARKER",
          "marks": "PRIMARY_TARGET",
          "offset": "goal_side_1m"
        },
        {
          "role": "MAN_MARKER",
          "marks": "SECONDARY_TARGET",
          "index": 0,
          "offset": "goal_side_1m"
        },
        {
          "role": "MAN_MARKER",
          "marks": "SECONDARY_TARGET",
          "index": 1,
          "offset": "goal_side_1m"
        },
        {
          "role": "COUNTER_OUTLET",
          "at": [
            70,
            34
          ]
        }
      ]
    },
    {
      "template": "CRN_DEF_MIXED",
      "type": "CORNER_DEF",
      "version": "1.0.0",
      "params": {
        "side": {
          "enum": [
            "LEFT",
            "RIGHT"
          ],
          "required": true
        },
        "zonal_count": {
          "int": [
            3,
            7
          ],
          "default": 5
        },
        "man_count": {
          "int": [
            0,
            5
          ],
          "default": 3
        },
        "post_guard": {
          "enum": [
            "NONE",
            "NEAR",
            "BOTH"
          ],
          "default": "NEAR"
        },
        "outlets": {
          "int": [
            0,
            2
          ],
          "default": 1
        }
      },
      "role_defaults": {
        "GOALKEEPER": {
          "count": 1
        },
        "ZONAL_DEFENDER": {
          "count": "{zonal_count}",
          "zone_line": "six_yard_line_and_penalty_spot"
        },
        "MAN_MARKER": {
          "count": "{man_count}"
        },
        "POST_GUARD": {
          "count": "{post_guard == NEAR ? 1 : post_guard == BOTH ? 2 : 0}"
        },
        "EDGE_GUARD": {
          "count": 1
        },
        "COUNTER_OUTLET": {
          "count": "{outlets}"
        }
      },
      "fill_order": [
        "GOALKEEPER",
        "ZONAL_DEFENDER",
        "MAN_MARKER",
        "POST_GUARD",
        "EDGE_GUARD",
        "COUNTER_OUTLET"
      ],
      "outfield_total": 10,
      "constraints": [
        "GEO-01",
        "GEO-02",
        "GEO-03",
        "TAC-CRNDEF-01"
      ]
    }
  ]
} as const;
export const FORMATIONS_YAML = {
  "catalog_version": "1.0.0",
  "formations": {
    "F_433": {
      "label": "4-3-3",
      "voice": [
        "4 3 3",
        "cuatro tres tres"
      ],
      "slots": [
        {
          "slot": "GK",
          "u": 0.05,
          "v": 0.5
        },
        {
          "slot": "LB",
          "u": 0.24,
          "v": 0.12
        },
        {
          "slot": "CB_L",
          "u": 0.21,
          "v": 0.37
        },
        {
          "slot": "CB_R",
          "u": 0.21,
          "v": 0.63
        },
        {
          "slot": "RB",
          "u": 0.24,
          "v": 0.88
        },
        {
          "slot": "CM_L",
          "u": 0.42,
          "v": 0.3
        },
        {
          "slot": "DM",
          "u": 0.36,
          "v": 0.5
        },
        {
          "slot": "CM_R",
          "u": 0.42,
          "v": 0.7
        },
        {
          "slot": "LW",
          "u": 0.62,
          "v": 0.14
        },
        {
          "slot": "ST",
          "u": 0.66,
          "v": 0.5
        },
        {
          "slot": "RW",
          "u": 0.62,
          "v": 0.86
        }
      ]
    },
    "F_442": {
      "label": "4-4-2",
      "voice": [
        "4 4 2",
        "cuatro cuatro dos"
      ],
      "slots": [
        {
          "slot": "GK",
          "u": 0.05,
          "v": 0.5
        },
        {
          "slot": "LB",
          "u": 0.24,
          "v": 0.12
        },
        {
          "slot": "CB_L",
          "u": 0.21,
          "v": 0.37
        },
        {
          "slot": "CB_R",
          "u": 0.21,
          "v": 0.63
        },
        {
          "slot": "RB",
          "u": 0.24,
          "v": 0.88
        },
        {
          "slot": "LM",
          "u": 0.44,
          "v": 0.12
        },
        {
          "slot": "CM_L",
          "u": 0.4,
          "v": 0.38
        },
        {
          "slot": "CM_R",
          "u": 0.4,
          "v": 0.62
        },
        {
          "slot": "RM",
          "u": 0.44,
          "v": 0.88
        },
        {
          "slot": "ST_L",
          "u": 0.63,
          "v": 0.4
        },
        {
          "slot": "ST_R",
          "u": 0.63,
          "v": 0.6
        }
      ]
    },
    "F_4231": {
      "label": "4-2-3-1",
      "voice": [
        "4 2 3 1",
        "cuatro dos tres uno"
      ],
      "slots": [
        {
          "slot": "GK",
          "u": 0.05,
          "v": 0.5
        },
        {
          "slot": "LB",
          "u": 0.24,
          "v": 0.12
        },
        {
          "slot": "CB_L",
          "u": 0.21,
          "v": 0.37
        },
        {
          "slot": "CB_R",
          "u": 0.21,
          "v": 0.63
        },
        {
          "slot": "RB",
          "u": 0.24,
          "v": 0.88
        },
        {
          "slot": "DM_L",
          "u": 0.36,
          "v": 0.4
        },
        {
          "slot": "DM_R",
          "u": 0.36,
          "v": 0.6
        },
        {
          "slot": "LW",
          "u": 0.54,
          "v": 0.15
        },
        {
          "slot": "AM",
          "u": 0.52,
          "v": 0.5
        },
        {
          "slot": "RW",
          "u": 0.54,
          "v": 0.85
        },
        {
          "slot": "ST",
          "u": 0.66,
          "v": 0.5
        }
      ]
    },
    "F_352": {
      "label": "3-5-2",
      "voice": [
        "3 5 2",
        "tres cinco dos"
      ],
      "slots": [
        {
          "slot": "GK",
          "u": 0.05,
          "v": 0.5
        },
        {
          "slot": "CB_L",
          "u": 0.21,
          "v": 0.3
        },
        {
          "slot": "CB_C",
          "u": 0.19,
          "v": 0.5
        },
        {
          "slot": "CB_R",
          "u": 0.21,
          "v": 0.7
        },
        {
          "slot": "LWB",
          "u": 0.4,
          "v": 0.08
        },
        {
          "slot": "CM_L",
          "u": 0.42,
          "v": 0.33
        },
        {
          "slot": "DM",
          "u": 0.36,
          "v": 0.5
        },
        {
          "slot": "CM_R",
          "u": 0.42,
          "v": 0.67
        },
        {
          "slot": "RWB",
          "u": 0.4,
          "v": 0.92
        },
        {
          "slot": "ST_L",
          "u": 0.63,
          "v": 0.4
        },
        {
          "slot": "ST_R",
          "u": 0.63,
          "v": 0.6
        }
      ]
    },
    "F_532": {
      "label": "5-3-2",
      "voice": [
        "5 3 2",
        "cinco tres dos"
      ],
      "slots": [
        {
          "slot": "GK",
          "u": 0.05,
          "v": 0.5
        },
        {
          "slot": "LWB",
          "u": 0.25,
          "v": 0.08
        },
        {
          "slot": "CB_L",
          "u": 0.2,
          "v": 0.3
        },
        {
          "slot": "CB_C",
          "u": 0.18,
          "v": 0.5
        },
        {
          "slot": "CB_R",
          "u": 0.2,
          "v": 0.7
        },
        {
          "slot": "RWB",
          "u": 0.25,
          "v": 0.92
        },
        {
          "slot": "CM_L",
          "u": 0.4,
          "v": 0.3
        },
        {
          "slot": "CM_C",
          "u": 0.38,
          "v": 0.5
        },
        {
          "slot": "CM_R",
          "u": 0.4,
          "v": 0.7
        },
        {
          "slot": "ST_L",
          "u": 0.62,
          "v": 0.4
        },
        {
          "slot": "ST_R",
          "u": 0.62,
          "v": 0.6
        }
      ]
    },
    "F_4141": {
      "label": "4-1-4-1",
      "voice": [
        "4 1 4 1",
        "cuatro uno cuatro uno"
      ],
      "slots": [
        {
          "slot": "GK",
          "u": 0.05,
          "v": 0.5
        },
        {
          "slot": "LB",
          "u": 0.24,
          "v": 0.12
        },
        {
          "slot": "CB_L",
          "u": 0.21,
          "v": 0.37
        },
        {
          "slot": "CB_R",
          "u": 0.21,
          "v": 0.63
        },
        {
          "slot": "RB",
          "u": 0.24,
          "v": 0.88
        },
        {
          "slot": "DM",
          "u": 0.33,
          "v": 0.5
        },
        {
          "slot": "LM",
          "u": 0.47,
          "v": 0.12
        },
        {
          "slot": "CM_L",
          "u": 0.45,
          "v": 0.38
        },
        {
          "slot": "CM_R",
          "u": 0.45,
          "v": 0.62
        },
        {
          "slot": "RM",
          "u": 0.47,
          "v": 0.88
        },
        {
          "slot": "ST",
          "u": 0.65,
          "v": 0.5
        }
      ]
    }
  },
  "groups": {
    "CENTER_BACKS": [
      "CB_*"
    ],
    "FULLBACKS": [
      "LB",
      "RB",
      "LWB",
      "RWB"
    ],
    "WINGERS": [
      "LW",
      "RW"
    ],
    "STRIKERS": [
      "ST*",
      "SS"
    ],
    "MID": [
      "DM*",
      "CM*",
      "LM",
      "RM",
      "AM",
      "LWB_in_352",
      "RWB_in_352"
    ],
    "DEF": [
      "LB",
      "RB",
      "LWB",
      "RWB",
      "CB_*"
    ],
    "ATT": [
      "LW",
      "RW",
      "ST*",
      "SS"
    ]
  }
} as const;
export const CONSTRAINTS_YAML = {
  "catalog_version": "1.0.0",
  "rules": [
    {
      "id": "GEO-01",
      "class": "GEOMETRY",
      "severity": "error",
      "check": "actors_within",
      "params": {
        "min": -0.04,
        "max": 1.04
      },
      "message": "{actor} está fuera del terreno de juego."
    },
    {
      "id": "GEO-02",
      "class": "GEOMETRY",
      "severity": "error",
      "check": "max_per_team",
      "params": {
        "players": 11,
        "goalkeepers": 1
      },
      "message": "Hay {count} jugadores de {team}; el máximo es 11."
    },
    {
      "id": "GEO-03",
      "class": "GEOMETRY",
      "severity": "error",
      "check": "unique_player",
      "message": "{player} aparece dos veces."
    },
    {
      "id": "GEO-SPACING-01",
      "class": "GEOMETRY",
      "severity": "warning",
      "check": "min_teammate_distance",
      "params": {
        "meters": 1,
        "at_t": -2.5
      },
      "message": "{a} y {b} están a menos de 1 m."
    },
    {
      "id": "GEO-PATH-01",
      "class": "GEOMETRY",
      "severity": "warning",
      "check": "path_within",
      "except_roles": [
        "TAKER"
      ],
      "message": "La carrera de {actor} sale del campo."
    },
    {
      "id": "AVAIL-01",
      "class": "ROSTER",
      "severity": "warning",
      "check": "player_available",
      "message": "{player} figura como {status}."
    },
    {
      "id": "LAW-CRN-01",
      "class": "LAW",
      "law": "IFAB Regla 17",
      "severity": "error",
      "check": "ball_in_corner_area",
      "params": {
        "radius_m": 1
      },
      "message": "El balón debe estar en el área de esquina del lado {side}."
    },
    {
      "id": "LAW-CRN-02",
      "class": "LAW",
      "law": "IFAB Regla 17",
      "severity": "warning",
      "check": "opponents_min_distance_from_corner_arc",
      "params": {
        "meters": 9.15,
        "until": "KICK"
      },
      "message": "Los rivales deben estar a 9,15 m del área de esquina hasta el saque."
    },
    {
      "id": "LAW-CRN-03",
      "class": "LAW",
      "law": "IFAB Regla 17",
      "severity": "warning",
      "check": "taker_no_double_touch",
      "message": "El lanzador vuelve a tocar el balón antes que otro jugador (tiro libre indirecto)."
    },
    {
      "id": "LAW-FK-01",
      "class": "LAW",
      "law": "IFAB Regla 13",
      "severity": "warning",
      "check": "opponents_min_distance_from_ball",
      "params": {
        "meters": 9.15,
        "until": "KICK"
      },
      "message": "Los rivales deben estar a 9,15 m del balón."
    },
    {
      "id": "LAW-FK-02",
      "class": "LAW",
      "law": "IFAB Regla 13",
      "severity": "warning",
      "check": "attackers_min_distance_from_wall",
      "params": {
        "meters": 1,
        "wall_min_size": 3
      },
      "message": "Con barrera de 3 o más, los atacantes deben estar a 1 m de ella."
    },
    {
      "id": "LAW-TI-01",
      "class": "LAW",
      "law": "IFAB Regla 15",
      "severity": "warning",
      "check": "opponents_min_distance_from_ball",
      "params": {
        "meters": 2,
        "until": "KICK"
      },
      "message": "Los rivales deben estar a 2 m del punto del saque."
    },
    {
      "id": "LAW-KO-01",
      "class": "LAW",
      "law": "IFAB Regla 8",
      "severity": "warning",
      "check": "kickoff_halves",
      "message": "En el saque inicial todos deben estar en su propio campo."
    },
    {
      "id": "LAW-OFF-INFO",
      "class": "LAW",
      "law": "IFAB Regla 11",
      "severity": "info",
      "check": "offside_info",
      "message": "No hay fuera de juego al recibir directamente de córner o saque de banda; sí en tiros libres."
    },
    {
      "id": "LAW-IMP-01",
      "class": "LAW",
      "law": "IFAB Regla 12",
      "severity": "warning",
      "check": "screen_is_static",
      "params": {
        "static_window_s": 0.3,
        "max_speed_mps": 0.5
      },
      "message": "El bloqueo se mueve hacia el rival justo antes de su paso: riesgo de sanción por impedir el avance. La legalidad la decide el árbitro."
    },
    {
      "id": "TECH-SWING-01",
      "class": "TECHNIQUE",
      "severity": "warning",
      "check": "swing_matches_foot_and_side",
      "message": "{player} es {foot}: desde la {side} su golpeo natural sale {natural_swing}. Has pedido {requested_swing}."
    },
    {
      "id": "TECH-FOOT-CONFLICT",
      "class": "TECHNIQUE",
      "severity": "clarification",
      "check": "asserted_foot_matches_profile",
      "message": "Has dicho que {player} es {asserted}, pero su ficha indica {profile}."
    },
    {
      "id": "ROLE-01",
      "class": "TACTICAL",
      "severity": "warning",
      "check": "own_gk_role",
      "message": "El portero tiene asignado el rol {role}."
    },
    {
      "id": "ROLE-02",
      "class": "TACTICAL",
      "severity": "warning",
      "check": "role_movement_compatible",
      "message": "El rol {role} no suele usar el movimiento {movement}."
    },
    {
      "id": "TAC-CRN-REST-01",
      "class": "TACTICAL",
      "configurable": true,
      "severity": "warning",
      "check": "min_role_count",
      "params": {
        "role": "REST_DEFENDER",
        "min": 1
      },
      "message": "No queda nadie de vigilancia: recomendación del equipo, no obligación."
    },
    {
      "id": "TAC-CRN-TGT-01",
      "class": "TACTICAL",
      "configurable": true,
      "severity": "warning",
      "check": "someone_attacks_target",
      "message": "Nadie ataca la zona donde va el balón ({zone})."
    },
    {
      "id": "TAC-CRN-OVR-01",
      "class": "TACTICAL",
      "configurable": true,
      "severity": "info",
      "check": "max_per_zone",
      "params": {
        "max": 3
      },
      "message": "Hay {count} jugadores en {zone}."
    },
    {
      "id": "TAC-CRNDEF-01",
      "class": "TACTICAL",
      "configurable": true,
      "severity": "warning",
      "check": "near_post_covered",
      "message": "El primer palo queda sin defensor."
    },
    {
      "id": "SEQ-SCREEN-01",
      "class": "SEQUENCE",
      "severity": "warning",
      "check": "screen_set_before_beneficiary",
      "params": {
        "lead_s": 0.3
      },
      "message": "El bloqueo se establece {gap}s tarde. Propuesta: empezar {fix_s}s antes."
    },
    {
      "id": "SEQ-CYCLE-01",
      "class": "SEQUENCE",
      "severity": "error",
      "check": "acyclic_dependencies",
      "message": "Las dependencias de tiempos forman un ciclo."
    },
    {
      "id": "SCH-SYNC-01",
      "class": "SEQUENCE",
      "severity": "warning",
      "check": "primary_arrives_with_ball",
      "params": {
        "tolerance_s": 0.15
      },
      "message": "{actor} llega {gap}s {early_late} respecto al balón."
    },
    {
      "id": "SCH-NEG-01",
      "class": "SEQUENCE",
      "severity": "warning",
      "check": "no_start_before",
      "params": {
        "t": -2.5
      },
      "message": "Un movimiento empieza antes del inicio de la jugada."
    },
    {
      "id": "SEQ-CONSTR-01",
      "class": "SEQUENCE",
      "severity": "error",
      "check": "explicit_constraints_hold",
      "message": "{actor} incumple tu indicación: {constraint}."
    },
    {
      "id": "BALL-TGT-01",
      "class": "TACTICAL",
      "severity": "info",
      "check": "default_target_info",
      "message": "Destino del balón propuesto: {zone} (zona del rematador principal)."
    },
    {
      "id": "LINEUP-01",
      "class": "LINEUP",
      "severity": "error",
      "check": "lineup_eleven",
      "message": "La alineación tiene {count} jugadores."
    },
    {
      "id": "LINEUP-02",
      "class": "LINEUP",
      "severity": "error",
      "check": "lineup_unique_players",
      "message": "{player} está en dos posiciones."
    },
    {
      "id": "LINEUP-03",
      "class": "LINEUP",
      "severity": "error",
      "check": "lineup_one_gk",
      "message": "Debe haber exactamente un portero."
    },
    {
      "id": "LINEUP-04",
      "class": "LINEUP",
      "severity": "warning",
      "check": "lineup_available",
      "message": "{player} no está disponible ({status})."
    },
    {
      "id": "LINEUP-05",
      "class": "LINEUP",
      "severity": "info",
      "check": "lineup_position_fit",
      "message": "{player} no tiene {slot} entre sus posiciones."
    },
    {
      "id": "LINEUP-06",
      "class": "LINEUP",
      "severity": "warning",
      "check": "lineup_line_spacing",
      "params": {
        "min_m": 6
      },
      "message": "Las líneas {a} y {b} están a menos de 6 m."
    },
    {
      "id": "NARR-SETUP",
      "class": "SEQUENCE",
      "severity": "info",
      "check": "narration",
      "message": "Colocación inicial."
    },
    {
      "id": "NARR-BLOCK",
      "class": "SEQUENCE",
      "severity": "info",
      "check": "narration",
      "message": "{blocker} bloquea a {defender}."
    },
    {
      "id": "NARR-DELIVERY",
      "class": "SEQUENCE",
      "severity": "info",
      "check": "narration",
      "message": "{taker} golpea hacia {zone}."
    },
    {
      "id": "NARR-RUN",
      "class": "SEQUENCE",
      "severity": "info",
      "check": "narration",
      "message": "{actor} ataca {zone}."
    },
    {
      "id": "NARR-PRESS",
      "class": "TACTICAL",
      "severity": "info",
      "check": "narration",
      "message": "{presser} presiona a {target}."
    },
    {
      "id": "NARR-REST",
      "class": "TACTICAL",
      "severity": "info",
      "check": "narration",
      "message": "Vigilancias."
    },
    {
      "id": "NARR-FREE",
      "class": "TACTICAL",
      "severity": "info",
      "check": "narration",
      "message": "Hombre libre: {actor}."
    },
    {
      "id": "NARR-BALL",
      "class": "TACTICAL",
      "severity": "info",
      "check": "narration",
      "message": "Balón en {holder}."
    }
  ]
} as const;
