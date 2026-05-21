package gui;

import actions.Mouse;
import application.Main;
import game.Board;
import game.Figur;
import game.Koenig;

import javax.swing.*;
import java.awt.*;

public class Draw extends JLabel {
    Point p;

    Font f = new Font("Arial", Font.PLAIN, 20);

    protected void paintComponent(Graphics g) {
        super.paintComponent(g);

        g.setColor(new Color(255, 247, 230));
        g.fillRect(0, 0, Gui.width, Gui.height);

        //Weiße Kacheln
        g.setColor(new Color(255, 230, 179));
        for (int i = 0; i < 8; i += 2) {
            for (int j = 0; j < 8; j++) {
                if (j % 2 == 0) {

                    g.fillRect(i * 80 + Gui.fieldx, j * 80 + Gui.fieldy, 80, 80);
                } else {
                    g.fillRect((i + 1) * 80 + Gui.fieldx, j * 80 + Gui.fieldy, 80, 80);
                }

            }
        }
        //Schwarze Kacheln
        g.setColor(new Color(134, 89, 45));
        for (int i = 0; i < 8; i += 2) {
            for (int j = 0; j < 8; j++) {
                if (j % 2 == 0) {

                    g.fillRect((i + 1) * 80 + Gui.fieldx, j * 80 + Gui.fieldy, 80, 80);
                } else {
                    g.fillRect(i * 80 + Gui.fieldx, j * 80 + Gui.fieldy, 80, 80);
                }

            }
        }

        //Beschriftung
        g.setColor(Color.BLACK);
        g.setFont(f);
        for (int i = 0; i < 8; i++) {
            g.drawString("" + (i + 1), Gui.fieldx - 20, Gui.fieldy + Gui.fieldsize - 30 - (i * 80));

            g.drawString(String.valueOf((char) (65 + i)), Gui.fieldx + 35 + (i * 80), Gui.fieldy + Gui.fieldsize + 25);
        }


        //Mousehover
        if (Mouse.insideField) {
            p = Mouse.ptc(Mouse.pos);
            g.setColor(new Color(153, 255, 102, 100));
            g.fillRect(p.x, p.y, 80, 80);
        }


        //Figuren

        for (int i = 0; i < 8; i++) {
            for (int j = 0; j < 8; j++) {
                if (Board.board[i][j] != null) {
                    Point pos = Mouse.ptc(new Point(i, j));
                    g.drawImage(Board.board[i][j].getImg(), pos.x, pos.y, null);

                    if (Board.board[i][j].isActive()) {
                        g.setColor(Color.BLUE);
                        g.drawRect(pos.x + 1, pos.y + 1, 78, 78);
                    }
                }
            }
        }

        for (int i = 0; i < 8; i++) {
            for (int j = 0; j < 8; j++) {
                if (Board.board[i][j] != null) {
                    if (Board.board[i][j].isActive()) {
                        for (Point moves : Board.board[i][j].getMoves()) {
                            Point cmoves = Mouse.ptc(moves);

                            if (Board.board[moves.x][moves.y] != null) {
                                if (Board.board[moves.x][moves.y] instanceof Koenig) {
                                    g.setColor(new Color(204, 51, 0));
                                    g.fillOval(cmoves.x + 27, cmoves.y + 27, 25, 25);
                                } else {
                                    g.setColor(new Color(255, 153, 0));
                                    g.fillOval(cmoves.x + 27, cmoves.y + 27, 25, 25);
                                }

                            } else {
                                g.setColor(new Color(0, 179, 0));
                                g.fillOval(cmoves.x + 27, cmoves.y + 27, 25, 25);
                            }
                        }
                    }
                }
            }
        }

        if (Board.lastFrom.x != -1 && Board.lastFrom.y != -1) {
            p = Mouse.ptc(Board.lastFrom);
            g.setColor(new Color(0, 179, 0));
            g.drawRect(p.x + 1, p.y + 1, 78, 78);
        }

        if (Board.lastTo.x != -1 && Board.lastTo.y != -1) {
            p = Mouse.ptc(Board.lastTo);
            g.setColor(new Color(0, 179, 0));
            g.drawRect(p.x + 1, p.y + 1, 78, 78);
        }


        //Grid
        g.setColor(Color.GRAY);
        for (int i = 0; i < 8; i++) {
            for (int j = 0; j < 8; j++) {
                g.drawRect(i * 80 + Gui.fieldx, j * 80 + Gui.fieldy, 80, 80);
            }
        }

        //Border
        g.setColor(Color.DARK_GRAY);
        g.drawRect(Gui.fieldx, Gui.fieldy, Gui.fieldsize, Gui.fieldsize);

        //UI

        g.setColor(new Color(233, 203, 168));
        g.fillRect(-1, 50, 150, 45);
        g.setColor(new Color(109, 72, 37));
        g.drawRect(-1, 50, 150, 300);

        g.drawLine(-1, 95, 149, 95);

        g.drawLine(-1, 150, 149, 150);

        g.setColor(Color.BLACK);
        if (Board.turnWhite) {
            g.drawString("Zug: Weiß", 25, 80);
        } else {
            g.drawString("Zug: Schwarz", 10, 80);
        }

        g.setFont(new Font("Arial", Font.PLAIN, 18));
        if (Board.lastFrom.x != -1 && Board.lastFrom.y != -1 && Board.lastTo.x != -1 && Board.lastTo.y != -1) {
            g.drawString(Board.posToString(Board.lastFrom)
                    + " -> " + Board.posToString(Board.lastTo), 30, 130);
        }

        //Umwandlung
        g.drawString("Umwandlung in:", 10, 185);

        if (Board.turnWhite) {
            g.drawImage(Board.umwandelnW.getImg(), 35, 205, null);
        } else {
            g.drawImage(Board.umwandelnB.getImg(), 35, 205, null);
        }

        //Multiplayer
        if (Main.multRunning) {
            g.setColor(new Color(109, 72, 37));
            g.drawRect(-1, 350, 150, 160);
            g.drawRect(-1, 510, 150, 80);

            g.setColor(Color.BLACK);
            g.drawString("Status:", 10, 375);

            g.drawString("Server IP:", 10, 405);

            g.drawString("Server Port:", 10, 460);

            g.drawString("Eigene Farbe:", 10, 540);

            if (Main.isServer) {
                if (Board.serverWhite) {
                    g.drawString("Weiß", 10, 575);
                } else {
                    g.drawString("Schwarz", 10, 575);
                }
            } else {
                if (Board.serverWhite) {
                    g.drawString("Schwarz", 10, 575);
                } else {
                    g.drawString("Weiß", 10, 575);
                }
            }

            //Status
            if (Main.waiting) {
                g.setColor(new Color(255, 153, 0));
            } else if (Main.connected) {
                g.setColor(new Color(0, 179, 0));
            } else {
                g.setColor(new Color(204, 51, 0));
            }

            g.fillOval(80, 361, 15, 15);

        }


        g.setFont(new Font("Arial", Font.BOLD, 50));

        if (Board.gameOver) {
            g.setColor(new Color(0, 0, 0, 150));
            g.fillRect(Gui.fieldx, Gui.height / 2 - 120, Gui.fieldsize, 160);
            g.setColor(new Color(255, 55, 0));
            if (Board.gewinnerWhite) {
                int width = g.getFontMetrics().stringWidth("Gewinner: Weiß");
                g.drawString("Gewinner: Weiß", Gui.width / 2 - width / 2, Gui.height / 2 - 20);
            } else {
                int width = g.getFontMetrics().stringWidth("Gewinner: Schwarz");
                g.drawString("Gewinner: Schwarz", Gui.width / 2 - width / 2, Gui.height / 2 - 20);
            }
        }


        repaint();
    }
}
