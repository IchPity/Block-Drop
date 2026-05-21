package game;

import actions.Mouse;
import application.Client;
import application.Main;
import application.Server;
import gui.IL;

import java.awt.*;

public class Board {

    public static Figur[][] board = new Figur[8][8];
    public static boolean turnWhite = true, gameOver = false, gewinnerWhite = true;
    public static boolean serverWhite = true;

    public static Point lastFrom = new Point(), lastTo = new Point();

    public static Figur umwandelnW = new Dame(true, IL.figurenW[1]), umwandelnB = new Dame(false, IL.figurenB[1]);



    public Board() {

        reset();

    }

    public static void reset() {

        lastFrom = new Point(-1, -1);
        lastTo = new Point(-1, -1);

        turnWhite = true;
        gameOver = false;
        gewinnerWhite = true;

        for (int i = 0; i < 8; i++) {
            for (int j = 0; j < 8; j++) {
                board[i][j] = null;
            }
        }

        //Bauern Weiß
        for (int i = 0; i < 8; i++) {
            board[i][6] = new Bauer(true, IL.figurenW[5]);
        }
        //Hintere Reihe Weiß
        board[0][7] = new Turm(true, IL.figurenW[4]);
        board[1][7] = new Springer(true, IL.figurenW[3]);
        board[2][7] = new Laeufer(true, IL.figurenW[2]);
        board[3][7] = new Dame(true, IL.figurenW[1]);
        board[4][7] = new Koenig(true, IL.figurenW[0]);
        board[5][7] = new Laeufer(true, IL.figurenW[2]);
        board[6][7] = new Springer(true, IL.figurenW[3]);
        board[7][7] = new Turm(true, IL.figurenW[4]);

        //Bauern Schwarz
        for (int i = 0; i < 8; i++) {
            board[i][1] = new Bauer(false, IL.figurenB[5]);
        }

        //Hintere Reihe Schwarz
        board[0][0] = new Turm(false, IL.figurenB[4]);
        board[1][0] = new Springer(false, IL.figurenB[3]);
        board[2][0] = new Laeufer(false, IL.figurenB[2]);
        board[3][0] = new Dame(false, IL.figurenB[1]);
        board[4][0] = new Koenig(false, IL.figurenB[0]);
        board[5][0] = new Laeufer(false, IL.figurenB[2]);
        board[6][0] = new Springer(false, IL.figurenB[3]);
        board[7][0] = new Turm(false, IL.figurenB[4]);

        //Test

    }

    public static String posToString(Point p) {
        String x = String.valueOf((char) (65 + p.x));
        String y = String.valueOf((char) (56 - p.y));
        return x + "," + y;
    }

    public static void moveFromTo(String s) {
        //x,y>x,y

        String[] fromTo = s.split(">");
        String[] sfrom = fromTo[0].split(",");
        String[] sto = fromTo[1].split(",");
        Point from = new Point(Integer.valueOf(sfrom[0]), Integer.valueOf(sfrom[1]));
        Point to = new Point(Integer.valueOf(sto[0]), Integer.valueOf(sto[1]));


        if (Board.board[from.x][from.y] != null) {
            Board.board[from.x][from.y].setActive(true);
            move(to);
        }

    }

    public static void move(Point p) {

        Figur active = null;
        int lastx = -1, lasty = -1;

        for (int i = 0; i < 8; i++) {
            for (int j = 0; j < 8; j++) {
                if (Board.board[i][j] != null) {
                    if (Board.board[i][j].isActive()) {
                        active = Board.board[i][j];
                        lastx = i;
                        lasty = j;
                    }
                }
            }
        }

        if (active != null && active.getMoves().contains(new Point(p.x, p.y))) {

            if (Board.board[p.x][p.y] instanceof Koenig) {
                if (Board.board[p.x][p.y].isWhite()) {
                    Board.gewinnerWhite = false;
                    Board.gameOver = true;
                } else {
                    Board.gewinnerWhite = true;
                    Board.gameOver = true;
                }

            }

            //Figuren bewegen
            Board.lastFrom.x = lastx;
            Board.lastFrom.y = lasty;
            Board.lastTo.x = p.x;
            Board.lastTo.y = p.y;

            Board.board[p.x][p.y] = Board.board[lastx][lasty];
            Board.board[lastx][lasty] = null;

            if (Main.multRunning) {
                if (Main.isServer) {
                    Server.send(Board.lastFrom.x + "," + Board.lastFrom.y
                            + ">" + Board.lastTo.x + "," + Board.lastTo.y);
                } else {
                    Client.send(Board.lastFrom.x + "," + Board.lastFrom.y
                            + ">" + Board.lastTo.x + "," + Board.lastTo.y);
                }
            }

            if (Board.board[p.x][p.y] instanceof Bauer) {
                Bauer b = (Bauer) Board.board[p.x][p.y];
                if (b.isErsterZug()) {
                    b.setErsterZug(false);
                }

                //Umwandlung
                if (b.isWhite() && p.y == 0) {
                    Board.board[p.x][p.y] = Board.umwandelnW;
                } else if (!b.isWhite() && p.y == 7) {
                    Board.board[p.x][p.y] = Board.umwandelnB;
                }

            }

            if (Board.board[p.x][p.y] instanceof Koenig) {
                Koenig k = (Koenig) Board.board[p.x][p.y];

                if (k.isWhite()) {
                    //Große Rochade
                    if (p.x + 2 == lastx) {
                        Board.board[3][7] = Board.board[0][7];
                        Board.board[0][7] = null;
                        k.setErsterZug(false);
                    }
                    //Kleine Rochade
                    else if (p.x - 2 == lastx) {
                        Board.board[5][7] = Board.board[7][7];
                        Board.board[7][7] = null;
                        k.setErsterZug(false);
                    }
                } else {
                    //Große Rochade
                    if (p.x + 2 == lastx) {
                        Board.board[3][0] = Board.board[0][0];
                        Board.board[0][0] = null;
                        k.setErsterZug(false);
                    }
                    //Kleine Rochade
                    else if (p.x - 2 == lastx) {
                        Board.board[5][0] = Board.board[7][0];
                        Board.board[7][0] = null;
                        k.setErsterZug(false);
                    }
                }

            }

            if (Board.board[p.x][p.y] instanceof Turm) {
                Turm t = (Turm) Board.board[p.x][p.y];
                if (t.isErsterZug()) {
                    t.setErsterZug(false);
                }
            }

            Board.turnWhite = !Board.turnWhite;

            Board.board[p.x][p.y].setActive(false);
            Board.refreshMoves();
            Board.refreshMoves();
        }

        for (int i = 0; i < 8; i++) {
            for (int j = 0; j < 8; j++) {
                if (Board.board[i][j] != null) {
                    Board.board[i][j].setActive(false);
                }

            }
        }

        if (Board.board[p.x][p.y] != null) {
            if (active == null || Board.board[p.x][p.y] != active) {
                if (Board.board[p.x][p.y].isWhite() == Board.turnWhite) {
                    Board.board[p.x][p.y].setActive(true);
                }
            }
        }
    }

    @SuppressWarnings("Duplicates")
    public static void refreshMoves() {

        for (int i = 0; i < 8; i++) {
            for (int j = 0; j < 8; j++) {
                if (board[i][j] != null) {
                    board[i][j].getMoves().clear();
                    //####################
                    //Bauer
                    //####################
                    if (board[i][j] instanceof Bauer) {
                        Bauer b = (Bauer) board[i][j];
                        if (b.isWhite()) {

                            if (j - 1 >= 0) {
                                if (board[i][j - 1] == null) {
                                    b.getMoves().add(new Point(i, j - 1));
                                }
                            }

                            if (b.ersterZug) {
                                if (board[i][j - 2] == null && board[i][j - 1] == null) {
                                    b.getMoves().add(new Point(i, j - 2));

                                }
                            }

                            if (i > 0 && j > 0) {
                                if (board[i - 1][j - 1] != null && !board[i - 1][j - 1].isWhite()) {
                                    b.getMoves().add(new Point(i - 1, j - 1));
                                }
                            }

                            if (i < 7 && j > 0) {
                                if (board[i + 1][j - 1] != null && !board[i + 1][j - 1].isWhite()) {
                                    b.getMoves().add(new Point(i + 1, j - 1));
                                }
                            }


                        } else {
                            if (j + 1 <= 7) {
                                if (board[i][j + 1] == null) {
                                    b.getMoves().add(new Point(i, j + 1));
                                }
                            }


                            if (b.ersterZug) {
                                if (board[i][j + 2] == null && board[i][j + 1] == null) {
                                    b.getMoves().add(new Point(i, j + 2));

                                }
                            }

                            if (i > 0 && j < 7) {
                                if (board[i - 1][j + 1] != null && board[i - 1][j + 1].isWhite()) {
                                    b.getMoves().add(new Point(i - 1, j + 1));
                                }
                            }

                            if (i < 7 && j < 7) {
                                if (board[i + 1][j + 1] != null && board[i + 1][j + 1].isWhite()) {
                                    b.getMoves().add(new Point(i + 1, j + 1));
                                }
                            }
                        }
                    }

                    //####################
                    //Turm
                    //####################
                    if (board[i][j] instanceof Turm) {
                        Turm t = (Turm) board[i][j];
                        if (t.isWhite()) {
                            int count = 1;
                            boolean blocked = false;
                            //Rechts
                            while (i + count <= 7 && !blocked) {
                                if (board[i + count][j] != null && board[i + count][j].isWhite()) {
                                    blocked = true;
                                } else if (board[i + count][j] != null && !board[i + count][j].isWhite()) {
                                    t.getMoves().add(new Point(i + count, j));
                                    blocked = true;
                                }
                                if (!blocked) {
                                    t.getMoves().add(new Point(i + count, j));
                                    count++;
                                }

                            }

                            count = 1;
                            blocked = false;
                            //Links
                            while (i - count >= 0 && !blocked) {
                                if (board[i - count][j] != null && board[i - count][j].isWhite()) {
                                    blocked = true;
                                } else if (board[i - count][j] != null && !board[i - count][j].isWhite()) {
                                    t.getMoves().add(new Point(i - count, j));
                                    blocked = true;
                                }

                                if (!blocked) {
                                    t.getMoves().add(new Point(i - count, j));
                                    count++;
                                }

                            }

                            count = 1;
                            blocked = false;
                            //Runter
                            while (j + count <= 7 && !blocked) {
                                if (board[i][j + count] != null && board[i][j + count].isWhite()) {
                                    blocked = true;
                                } else if (board[i][j + count] != null && !board[i][j + count].isWhite()) {
                                    t.getMoves().add(new Point(i, j + count));
                                    blocked = true;
                                }
                                if (!blocked) {
                                    t.getMoves().add(new Point(i, j + count));
                                    count++;
                                }

                            }

                            count = 1;
                            blocked = false;
                            //Hoch
                            while (j - count >= 0 && !blocked) {
                                if (board[i][j - count] != null && board[i][j - count].isWhite()) {
                                    blocked = true;
                                } else if (board[i][j - count] != null && !board[i][j - count].isWhite()) {
                                    t.getMoves().add(new Point(i, j - count));
                                    blocked = true;
                                }

                                if (!blocked) {
                                    t.getMoves().add(new Point(i, j - count));
                                    count++;
                                }

                            }


                        } else {
                            int count = 1;
                            boolean blocked = false;
                            //Rechts
                            while (i + count <= 7 && !blocked) {
                                if (board[i + count][j] != null && !board[i + count][j].isWhite()) {
                                    blocked = true;
                                } else if (board[i + count][j] != null && board[i + count][j].isWhite()) {
                                    t.getMoves().add(new Point(i + count, j));
                                    blocked = true;
                                }
                                if (!blocked) {
                                    t.getMoves().add(new Point(i + count, j));
                                    count++;
                                }

                            }

                            count = 1;
                            blocked = false;
                            //Links
                            while (i - count >= 0 && !blocked) {
                                if (board[i - count][j] != null && !board[i - count][j].isWhite()) {
                                    blocked = true;
                                } else if (board[i - count][j] != null && board[i - count][j].isWhite()) {
                                    t.getMoves().add(new Point(i - count, j));
                                    blocked = true;
                                }

                                if (!blocked) {
                                    t.getMoves().add(new Point(i - count, j));
                                    count++;
                                }

                            }

                            count = 1;
                            blocked = false;
                            //Runter
                            while (j + count <= 7 && !blocked) {
                                if (board[i][j + count] != null && !board[i][j + count].isWhite()) {
                                    blocked = true;
                                } else if (board[i][j + count] != null && board[i][j + count].isWhite()) {
                                    t.getMoves().add(new Point(i, j + count));
                                    blocked = true;
                                }
                                if (!blocked) {
                                    t.getMoves().add(new Point(i, j + count));
                                    count++;
                                }

                            }

                            count = 1;
                            blocked = false;
                            //Hoch
                            while (j - count >= 0 && !blocked) {
                                if (board[i][j - count] != null && !board[i][j - count].isWhite()) {
                                    blocked = true;
                                } else if (board[i][j - count] != null && board[i][j - count].isWhite()) {
                                    t.getMoves().add(new Point(i, j - count));
                                    blocked = true;
                                }

                                if (!blocked) {
                                    t.getMoves().add(new Point(i, j - count));
                                    count++;
                                }

                            }
                        }
                    }

                    //####################
                    //Springer
                    //####################
                    if (board[i][j] instanceof Springer) {
                        Springer s = (Springer) board[i][j];
                        if (s.isWhite()) {
                            if (i - 2 >= 0 && j - 1 >= 0) {
                                if (board[i - 2][j - 1] == null || !board[i - 2][j - 1].isWhite()) {
                                    s.getMoves().add(new Point(i - 2, j - 1));
                                }
                            }

                            if (i - 1 >= 0 && j - 2 >= 0) {
                                if (board[i - 1][j - 2] == null || !board[i - 1][j - 2].isWhite()) {
                                    s.getMoves().add(new Point(i - 1, j - 2));
                                }
                            }

                            if (i + 1 <= 7 && j - 2 >= 0) {
                                if (board[i + 1][j - 2] == null || !board[i + 1][j - 2].isWhite()) {
                                    s.getMoves().add(new Point(i + 1, j - 2));
                                }
                            }

                            if (i + 2 <= 7 && j - 1 >= 0) {
                                if (board[i + 2][j - 1] == null || !board[i + 2][j - 1].isWhite()) {
                                    s.getMoves().add(new Point(i + 2, j - 1));
                                }
                            }

                            if (i - 2 >= 0 && j + 1 <= 7) {
                                if (board[i - 2][j + 1] == null || !board[i - 2][j + 1].isWhite()) {
                                    s.getMoves().add(new Point(i - 2, j + 1));
                                }
                            }

                            if (i - 1 >= 0 && j + 2 <= 7) {
                                if (board[i - 1][j + 2] == null || !board[i - 1][j + 2].isWhite()) {
                                    s.getMoves().add(new Point(i - 1, j + 2));
                                }
                            }

                            if (i + 1 <= 7 && j + 2 <= 7) {
                                if (board[i + 1][j + 2] == null || !board[i + 1][j + 2].isWhite()) {
                                    s.getMoves().add(new Point(i + 1, j + 2));
                                }
                            }

                            if (i + 2 <= 7 && j + 1 <= 7) {
                                if (board[i + 2][j + 1] == null || !board[i + 2][j + 1].isWhite()) {
                                    s.getMoves().add(new Point(i + 2, j + 1));
                                }
                            }
                        } else {
                            if (i - 2 >= 0 && j - 1 >= 0) {
                                if (board[i - 2][j - 1] == null || board[i - 2][j - 1].isWhite()) {
                                    s.getMoves().add(new Point(i - 2, j - 1));
                                }
                            }

                            if (i - 1 >= 0 && j - 2 >= 0) {
                                if (board[i - 1][j - 2] == null || board[i - 1][j - 2].isWhite()) {
                                    s.getMoves().add(new Point(i - 1, j - 2));
                                }
                            }

                            if (i + 1 <= 7 && j - 2 >= 0) {
                                if (board[i + 1][j - 2] == null || board[i + 1][j - 2].isWhite()) {
                                    s.getMoves().add(new Point(i + 1, j - 2));
                                }
                            }

                            if (i + 2 <= 7 && j - 1 >= 0) {
                                if (board[i + 2][j - 1] == null || board[i + 2][j - 1].isWhite()) {
                                    s.getMoves().add(new Point(i + 2, j - 1));
                                }
                            }

                            if (i - 2 >= 0 && j + 1 <= 7) {
                                if (board[i - 2][j + 1] == null || board[i - 2][j + 1].isWhite()) {
                                    s.getMoves().add(new Point(i - 2, j + 1));
                                }
                            }

                            if (i - 1 >= 0 && j + 2 <= 7) {
                                if (board[i - 1][j + 2] == null || board[i - 1][j + 2].isWhite()) {
                                    s.getMoves().add(new Point(i - 1, j + 2));
                                }
                            }

                            if (i + 1 <= 7 && j + 2 <= 7) {
                                if (board[i + 1][j + 2] == null || board[i + 1][j + 2].isWhite()) {
                                    s.getMoves().add(new Point(i + 1, j + 2));
                                }
                            }

                            if (i + 2 <= 7 && j + 1 <= 7) {
                                if (board[i + 2][j + 1] == null || board[i + 2][j + 1].isWhite()) {
                                    s.getMoves().add(new Point(i + 2, j + 1));
                                }
                            }
                        }


                    }
                    //####################
                    //Laeufer
                    //####################
                    if (board[i][j] instanceof Laeufer) {
                        Laeufer l = (Laeufer) board[i][j];

                        if (l.isWhite()) {
                            int count = 1;
                            boolean blocked = false;

                            //Rechts unten
                            while (i + count <= 7 && j + count <= 7 && !blocked) {
                                if (board[i + count][j + count] != null && board[i + count][j + count].isWhite()) {
                                    blocked = true;
                                } else if (board[i + count][j + count] != null && !board[i + count][j + count].isWhite()) {
                                    l.getMoves().add(new Point(i + count, j + count));
                                    blocked = true;
                                }

                                if (!blocked) {
                                    l.getMoves().add(new Point(i + count, j + count));
                                    count++;
                                }
                            }

                            //Links unten
                            count = 1;
                            blocked = false;

                            while (i - count >= 0 && j + count <= 7 && !blocked) {
                                if (board[i - count][j + count] != null && board[i - count][j + count].isWhite()) {
                                    blocked = true;
                                } else if (board[i - count][j + count] != null && !board[i - count][j + count].isWhite()) {
                                    l.getMoves().add(new Point(i - count, j + count));
                                    blocked = true;
                                }

                                if (!blocked) {
                                    l.getMoves().add(new Point(i - count, j + count));
                                    count++;
                                }
                            }

                            //Links oben
                            count = 1;
                            blocked = false;

                            while (i - count >= 0 && j - count >= 0 && !blocked) {
                                if (board[i - count][j - count] != null && board[i - count][j - count].isWhite()) {
                                    blocked = true;
                                } else if (board[i - count][j - count] != null && !board[i - count][j - count].isWhite()) {
                                    l.getMoves().add(new Point(i - count, j - count));
                                    blocked = true;
                                }

                                if (!blocked) {
                                    l.getMoves().add(new Point(i - count, j - count));
                                    count++;
                                }
                            }

                            //Rechts oben
                            count = 1;
                            blocked = false;

                            while (i + count <= 7 && j - count >= 0 && !blocked) {
                                if (board[i + count][j - count] != null && board[i + count][j - count].isWhite()) {
                                    blocked = true;
                                } else if (board[i + count][j - count] != null && !board[i + count][j - count].isWhite()) {
                                    l.getMoves().add(new Point(i + count, j - count));
                                    blocked = true;
                                }

                                if (!blocked) {
                                    l.getMoves().add(new Point(i + count, j - count));
                                    count++;
                                }
                            }

                        } else {
                            int count = 1;
                            boolean blocked = false;

                            //Rechts unten
                            while (i + count <= 7 && j + count <= 7 && !blocked) {
                                if (board[i + count][j + count] != null && !board[i + count][j + count].isWhite()) {
                                    blocked = true;
                                } else if (board[i + count][j + count] != null && board[i + count][j + count].isWhite()) {
                                    l.getMoves().add(new Point(i + count, j + count));
                                    blocked = true;
                                }

                                if (!blocked) {
                                    l.getMoves().add(new Point(i + count, j + count));
                                    count++;
                                }
                            }


                            //Links oben
                            count = 1;
                            blocked = false;

                            while (i - count >= 0 && j - count >= 0 && !blocked) {
                                if (board[i - count][j - count] != null && !board[i - count][j - count].isWhite()) {
                                    blocked = true;
                                } else if (board[i - count][j - count] != null && board[i - count][j - count].isWhite()) {
                                    l.getMoves().add(new Point(i - count, j - count));
                                    blocked = true;
                                }

                                if (!blocked) {
                                    l.getMoves().add(new Point(i - count, j - count));
                                    count++;
                                }
                            }

                            //Links unten
                            count = 1;
                            blocked = false;

                            while (i - count >= 0 && j + count <= 7 && !blocked) {
                                if (board[i - count][j + count] != null && !board[i - count][j + count].isWhite()) {
                                    blocked = true;
                                } else if (board[i - count][j + count] != null && board[i - count][j + count].isWhite()) {
                                    l.getMoves().add(new Point(i - count, j + count));
                                    blocked = true;
                                }

                                if (!blocked) {
                                    l.getMoves().add(new Point(i - count, j + count));
                                    count++;
                                }
                            }


                            //Rechts oben
                            count = 1;
                            blocked = false;

                            while (i + count <= 7 && j - count >= 0 && !blocked) {
                                if (board[i + count][j - count] != null && !board[i + count][j - count].isWhite()) {
                                    blocked = true;
                                } else if (board[i + count][j - count] != null && board[i + count][j - count].isWhite()) {
                                    l.getMoves().add(new Point(i + count, j - count));
                                    blocked = true;
                                }

                                if (!blocked) {
                                    l.getMoves().add(new Point(i + count, j - count));
                                    count++;
                                }
                            }
                        }
                    }

                    //####################
                    //Koenig
                    //####################
                    if (board[i][j] instanceof Koenig) {
                        Koenig k = (Koenig) board[i][j];

                        if (k.isWhite()) {
                            if (i - 1 >= 0 && j - 1 >= 0) {
                                if (board[i - 1][j - 1] == null || !board[i - 1][j - 1].isWhite()) {
                                    k.getMoves().add(new Point(i - 1, j - 1));
                                }
                            }
                            if (j - 1 >= 0) {
                                if (board[i][j - 1] == null || !board[i][j - 1].isWhite()) {
                                    k.getMoves().add(new Point(i, j - 1));
                                }
                            }
                            if (i + 1 <= 7 && j - 1 >= 0) {
                                if (board[i + 1][j - 1] == null || !board[i + 1][j - 1].isWhite()) {
                                    k.getMoves().add(new Point(i + 1, j - 1));
                                }
                            }
                            if (i + 1 <= 7) {
                                if (board[i + 1][j] == null || !board[i + 1][j].isWhite()) {
                                    k.getMoves().add(new Point(i + 1, j));
                                }
                            }
                            if (i + 1 <= 7 && j + 1 <= 7) {
                                if (board[i + 1][j + 1] == null || !board[i + 1][j + 1].isWhite()) {
                                    k.getMoves().add(new Point(i + 1, j + 1));
                                }
                            }
                            if (j + 1 <= 7) {
                                if (board[i][j + 1] == null || !board[i][j + 1].isWhite()) {
                                    k.getMoves().add(new Point(i, j + 1));
                                }
                            }
                            if (i - 1 >= 0 && j + 1 <= 7) {
                                if (board[i - 1][j + 1] == null || !board[i - 1][j + 1].isWhite()) {
                                    k.getMoves().add(new Point(i - 1, j + 1));
                                }
                            }
                            if (i - 1 >= 0) {
                                if (board[i - 1][j] == null || !board[i - 1][j].isWhite()) {
                                    k.getMoves().add(new Point(i - 1, j));
                                }
                            }


                            if (k.ersterZug) {
                                boolean bedroht = false;
                                //Rochade klein
                                if (board[7][7] instanceof Turm) {
                                    Turm t = (Turm) board[7][7];
                                    if (t.ersterZug) {

                                        if (board[5][7] == null && board[6][7] == null) {

                                            //Überprüfe ob felder 5,7 und 6,7 bedroht sind
                                            for (int l = 0; l < 8; l++) {
                                                for (int m = 0; m < 8; m++) {
                                                    if (board[l][m] != null && !board[l][m].isWhite()) {
                                                        if (board[l][m].getMoves().contains(new Point(5, 7))
                                                                || board[l][m].getMoves().contains(new Point(6, 7))) {

                                                            bedroht = true;
                                                        }
                                                    }
                                                }
                                            }
                                            if (!bedroht) {
                                                k.getMoves().add(new Point(i + 2, j));
                                            }

                                        }

                                    }

                                }
                                bedroht = false;
                                //Rochade groß
                                if (board[0][7] instanceof Turm) {
                                    Turm t = (Turm) board[0][7];
                                    if (t.ersterZug) {

                                        if (board[1][7] == null && board[2][7] == null && board[3][7] == null) {


                                            //Überprüfe ob felder 1,7 , 2,7 und 3,7 bedroht sind
                                            for (int l = 0; l < 8; l++) {
                                                for (int m = 0; m < 8; m++) {
                                                    if (board[l][m] != null && !board[l][m].isWhite()) {
                                                        if (board[l][m].getMoves().contains(new Point(1, 7))
                                                                || board[l][m].getMoves().contains(new Point(2, 7))
                                                                || board[l][m].getMoves().contains(new Point(3, 7))) {

                                                            bedroht = true;
                                                        }
                                                    }
                                                }
                                            }

                                            if (!bedroht) {
                                                k.getMoves().add(new Point(i - 2, j));
                                            }

                                        }

                                    }
                                }
                                bedroht = false;
                            }
                        } else {
                            if (i - 1 >= 0 && j - 1 >= 0) {
                                if (board[i - 1][j - 1] == null || board[i - 1][j - 1].isWhite()) {
                                    k.getMoves().add(new Point(i - 1, j - 1));
                                }
                            }
                            if (j - 1 >= 0) {
                                if (board[i][j - 1] == null || board[i][j - 1].isWhite()) {
                                    k.getMoves().add(new Point(i, j - 1));
                                }
                            }
                            if (i + 1 <= 7 && j - 1 >= 0) {
                                if (board[i + 1][j - 1] == null || board[i + 1][j - 1].isWhite()) {
                                    k.getMoves().add(new Point(i + 1, j - 1));
                                }
                            }
                            if (i + 1 <= 7) {
                                if (board[i + 1][j] == null || board[i + 1][j].isWhite()) {
                                    k.getMoves().add(new Point(i + 1, j));
                                }
                            }
                            if (i + 1 <= 7 && j + 1 <= 7) {
                                if (board[i + 1][j + 1] == null || board[i + 1][j + 1].isWhite()) {
                                    k.getMoves().add(new Point(i + 1, j + 1));
                                }
                            }
                            if (j + 1 <= 7) {
                                if (board[i][j + 1] == null || board[i][j + 1].isWhite()) {
                                    k.getMoves().add(new Point(i, j + 1));
                                }
                            }
                            if (i - 1 >= 0 && j + 1 <= 7) {
                                if (board[i - 1][j + 1] == null || board[i - 1][j + 1].isWhite()) {
                                    k.getMoves().add(new Point(i - 1, j + 1));
                                }
                            }
                            if (i - 1 >= 0) {
                                if (board[i - 1][j] == null || board[i - 1][j].isWhite()) {
                                    k.getMoves().add(new Point(i - 1, j));
                                }
                            }

                            if (k.ersterZug) {
                                boolean bedroht = false;
                                //Rochade klein
                                if (board[7][0] instanceof Turm) {
                                    Turm t = (Turm) board[7][0];
                                    if (t.ersterZug) {

                                        if (board[5][0] == null && board[6][0] == null) {

                                            for (int l = 0; l < 8; l++) {
                                                for (int m = 0; m < 8; m++) {
                                                    if (board[l][m] != null && board[l][m].isWhite()) {
                                                        if (board[l][m].getMoves().contains(new Point(5, 0))
                                                                || board[l][m].getMoves().contains(new Point(6, 0))) {

                                                            bedroht = true;
                                                        }
                                                    }
                                                }
                                            }
                                            if (!bedroht) {
                                                k.getMoves().add(new Point(i + 2, j));
                                            }

                                        }

                                    }
                                }
                                //Rochade groß
                                bedroht = false;
                                if (board[0][0] instanceof Turm) {
                                    Turm t = (Turm) board[0][0];
                                    if (t.ersterZug) {

                                        if (board[1][0] == null && board[2][0] == null && board[3][0] == null) {

                                            for (int l = 0; l < 8; l++) {
                                                for (int m = 0; m < 8; m++) {
                                                    if (board[l][m] != null && board[l][m].isWhite()) {
                                                        if (board[l][m].getMoves().contains(new Point(1, 0))
                                                                || board[l][m].getMoves().contains(new Point(2, 0))
                                                                || board[l][m].getMoves().contains(new Point(3, 0))) {

                                                            bedroht = true;
                                                        }
                                                    }
                                                }
                                            }
                                            if (!bedroht) {
                                                k.getMoves().add(new Point(i - 2, j));
                                            }

                                        }

                                    }
                                }
                                bedroht = false;
                            }
                        }
                    }
                    //####################
                    //Dame
                    //####################
                    if (board[i][j] instanceof Dame) {
                        Dame d = (Dame) board[i][j];

                        if (d.isWhite()) {
                            int count = 1;
                            boolean blocked = false;
                            //Rechts
                            while (i + count <= 7 && !blocked) {
                                if (board[i + count][j] != null && board[i + count][j].isWhite()) {
                                    blocked = true;
                                } else if (board[i + count][j] != null && !board[i + count][j].isWhite()) {
                                    d.getMoves().add(new Point(i + count, j));
                                    blocked = true;
                                }
                                if (!blocked) {
                                    d.getMoves().add(new Point(i + count, j));
                                    count++;
                                }

                            }

                            count = 1;
                            blocked = false;
                            //Links
                            while (i - count >= 0 && !blocked) {
                                if (board[i - count][j] != null && board[i - count][j].isWhite()) {
                                    blocked = true;
                                } else if (board[i - count][j] != null && !board[i - count][j].isWhite()) {
                                    d.getMoves().add(new Point(i - count, j));
                                    blocked = true;
                                }

                                if (!blocked) {
                                    d.getMoves().add(new Point(i - count, j));
                                    count++;
                                }

                            }

                            count = 1;
                            blocked = false;
                            //Runter
                            while (j + count <= 7 && !blocked) {
                                if (board[i][j + count] != null && board[i][j + count].isWhite()) {
                                    blocked = true;
                                } else if (board[i][j + count] != null && !board[i][j + count].isWhite()) {
                                    d.getMoves().add(new Point(i, j + count));
                                    blocked = true;
                                }
                                if (!blocked) {
                                    d.getMoves().add(new Point(i, j + count));
                                    count++;
                                }

                            }

                            count = 1;
                            blocked = false;
                            //Hoch
                            while (j - count >= 0 && !blocked) {
                                if (board[i][j - count] != null && board[i][j - count].isWhite()) {
                                    blocked = true;
                                } else if (board[i][j - count] != null && !board[i][j - count].isWhite()) {
                                    d.getMoves().add(new Point(i, j - count));
                                    blocked = true;
                                }

                                if (!blocked) {
                                    d.getMoves().add(new Point(i, j - count));
                                    count++;
                                }

                            }


                            //Laeufer Code

                            count = 1;
                            blocked = false;

                            //Rechts unten
                            while (i + count <= 7 && j + count <= 7 && !blocked) {
                                if (board[i + count][j + count] != null && board[i + count][j + count].isWhite()) {
                                    blocked = true;
                                } else if (board[i + count][j + count] != null && !board[i + count][j + count].isWhite()) {
                                    d.getMoves().add(new Point(i + count, j + count));
                                    blocked = true;
                                }

                                if (!blocked) {
                                    d.getMoves().add(new Point(i + count, j + count));
                                    count++;
                                }
                            }

                            //Links unten
                            count = 1;
                            blocked = false;

                            while (i - count >= 0 && j + count <= 7 && !blocked) {
                                if (board[i - count][j + count] != null && board[i - count][j + count].isWhite()) {
                                    blocked = true;
                                } else if (board[i - count][j + count] != null && !board[i - count][j + count].isWhite()) {
                                    d.getMoves().add(new Point(i - count, j + count));
                                    blocked = true;
                                }

                                if (!blocked) {
                                    d.getMoves().add(new Point(i - count, j + count));
                                    count++;
                                }
                            }

                            //Links oben
                            count = 1;
                            blocked = false;

                            while (i - count >= 0 && j - count >= 0 && !blocked) {
                                if (board[i - count][j - count] != null && board[i - count][j - count].isWhite()) {
                                    blocked = true;
                                } else if (board[i - count][j - count] != null && !board[i - count][j - count].isWhite()) {
                                    d.getMoves().add(new Point(i - count, j - count));
                                    blocked = true;
                                }

                                if (!blocked) {
                                    d.getMoves().add(new Point(i - count, j - count));
                                    count++;
                                }
                            }

                            //Rechts oben
                            count = 1;
                            blocked = false;

                            while (i + count <= 7 && j - count >= 0 && !blocked) {
                                if (board[i + count][j - count] != null && board[i + count][j - count].isWhite()) {
                                    blocked = true;
                                } else if (board[i + count][j - count] != null && !board[i + count][j - count].isWhite()) {
                                    d.getMoves().add(new Point(i + count, j - count));
                                    blocked = true;
                                }

                                if (!blocked) {
                                    d.getMoves().add(new Point(i + count, j - count));
                                    count++;
                                }
                            }

                        } else {
                            int count = 1;
                            boolean blocked = false;
                            //Rechts
                            while (i + count <= 7 && !blocked) {
                                if (board[i + count][j] != null && !board[i + count][j].isWhite()) {
                                    blocked = true;
                                } else if (board[i + count][j] != null && board[i + count][j].isWhite()) {
                                    d.getMoves().add(new Point(i + count, j));
                                    blocked = true;
                                }
                                if (!blocked) {
                                    d.getMoves().add(new Point(i + count, j));
                                    count++;
                                }

                            }

                            count = 1;
                            blocked = false;
                            //Links
                            while (i - count >= 0 && !blocked) {
                                if (board[i - count][j] != null && !board[i - count][j].isWhite()) {
                                    blocked = true;
                                } else if (board[i - count][j] != null && board[i - count][j].isWhite()) {
                                    d.getMoves().add(new Point(i - count, j));
                                    blocked = true;
                                }

                                if (!blocked) {
                                    d.getMoves().add(new Point(i - count, j));
                                    count++;
                                }

                            }

                            count = 1;
                            blocked = false;
                            //Runter
                            while (j + count <= 7 && !blocked) {
                                if (board[i][j + count] != null && !board[i][j + count].isWhite()) {
                                    blocked = true;
                                } else if (board[i][j + count] != null && board[i][j + count].isWhite()) {
                                    d.getMoves().add(new Point(i, j + count));
                                    blocked = true;
                                }
                                if (!blocked) {
                                    d.getMoves().add(new Point(i, j + count));
                                    count++;
                                }

                            }

                            count = 1;
                            blocked = false;
                            //Hoch
                            while (j - count >= 0 && !blocked) {
                                if (board[i][j - count] != null && !board[i][j - count].isWhite()) {
                                    blocked = true;
                                } else if (board[i][j - count] != null && board[i][j - count].isWhite()) {
                                    d.getMoves().add(new Point(i, j - count));
                                    blocked = true;
                                }

                                if (!blocked) {
                                    d.getMoves().add(new Point(i, j - count));
                                    count++;
                                }

                            }

                            //Laeufer Code

                            count = 1;
                            blocked = false;

                            //Rechts unten
                            while (i + count <= 7 && j + count <= 7 && !blocked) {
                                if (board[i + count][j + count] != null && !board[i + count][j + count].isWhite()) {
                                    blocked = true;
                                } else if (board[i + count][j + count] != null && board[i + count][j + count].isWhite()) {
                                    d.getMoves().add(new Point(i + count, j + count));
                                    blocked = true;
                                }

                                if (!blocked) {
                                    d.getMoves().add(new Point(i + count, j + count));
                                    count++;
                                }
                            }


                            //Links oben
                            count = 1;
                            blocked = false;

                            while (i - count >= 0 && j - count >= 0 && !blocked) {
                                if (board[i - count][j - count] != null && !board[i - count][j - count].isWhite()) {
                                    blocked = true;
                                } else if (board[i - count][j - count] != null && board[i - count][j - count].isWhite()) {
                                    d.getMoves().add(new Point(i - count, j - count));
                                    blocked = true;
                                }

                                if (!blocked) {
                                    d.getMoves().add(new Point(i - count, j - count));
                                    count++;
                                }
                            }

                            //Links unten
                            count = 1;
                            blocked = false;

                            while (i - count >= 0 && j + count <= 7 && !blocked) {
                                if (board[i - count][j + count] != null && !board[i - count][j + count].isWhite()) {
                                    blocked = true;
                                } else if (board[i - count][j + count] != null && board[i - count][j + count].isWhite()) {
                                    d.getMoves().add(new Point(i - count, j + count));
                                    blocked = true;
                                }

                                if (!blocked) {
                                    d.getMoves().add(new Point(i - count, j + count));
                                    count++;
                                }
                            }


                            //Rechts oben
                            count = 1;
                            blocked = false;

                            while (i + count <= 7 && j - count >= 0 && !blocked) {
                                if (board[i + count][j - count] != null && !board[i + count][j - count].isWhite()) {
                                    blocked = true;
                                } else if (board[i + count][j - count] != null && board[i + count][j - count].isWhite()) {
                                    d.getMoves().add(new Point(i + count, j - count));
                                    blocked = true;
                                }

                                if (!blocked) {
                                    d.getMoves().add(new Point(i + count, j - count));
                                    count++;
                                }
                            }
                        }
                    }

                }
            }
        }


    }
}
